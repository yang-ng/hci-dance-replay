import { useEffect, useRef, useState } from 'react'

const formats = [
  { id: 'Solo', count: '1', description: 'Focus on your own movement.' },
  { id: 'Partner', count: '2', description: 'Review a duet and compare how you read each cue.' },
  { id: 'Group', count: '3+', description: 'Review timing, spacing, and formations together.' },
]

const referenceMode = { id: 'reference', title: 'Reference comparison', description: 'Compare your practice with a reference dance clip.', icon: 'play' }
const reviewModes = {
  Solo: [
    { id: 'self', title: 'Self-review', description: 'Reflect on your practice with timestamped notes.', icon: 'comment' },
    { id: 'coach', title: 'Coach review', description: 'Watch with a coach and enter feedback on this device.', icon: 'comment' },
    referenceMode,
  ],
  Partner: [
    { id: 'partner', title: 'Partner feedback', description: 'Mark cues separately and see where they line up.', icon: 'comment' },
    referenceMode,
  ],
  Group: [
    { id: 'group', title: 'Group review', description: 'Capture each dancer’s observations on this device.', icon: 'comment' },
    referenceMode,
  ],
}

export function isVideo(file) {
  return file?.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|ogv)$/i.test(file?.name || '')
}

function Option({ Icon, title, description, icon, count, onClick, variant = '' }) {
  return <button type="button" className={`setup-option ${variant}`} onClick={onClick}>
    <span className="setup-icon">{count || <Icon name={icon} size={22} />}</span>
    <span><strong>{title}</strong><small>{description}</small></span>
    <Icon name="arrow" size={17} />
  </button>
}

function Camera({ Icon, onUse }) {
  const preview = useRef(null)
  const stream = useRef(null)
  const recorder = useRef(null)
  const request = useRef(0)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [capture, setCapture] = useState(null)
  const [url, setUrl] = useState('')
  const [duration, setDuration] = useState(0)

  useEffect(() => () => {
    request.current += 1
    if (recorder.current?.state === 'recording') recorder.current.stop()
    stream.current?.getTracks().forEach(track => track.stop())
  }, [])

  useEffect(() => {
    if (!capture) return
    const objectUrl = URL.createObjectURL(capture)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [capture])

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Camera recording is unavailable in this browser. You can upload a recording instead.')
      return
    }
    const ticket = ++request.current
    setCapture(null)
    setUrl('')
    setError('')
    setStatus('requesting')
    setDuration(0)
    let media
    try {
      media = await navigator.mediaDevices.getUserMedia({ video: true })
      if (ticket !== request.current) {
        media.getTracks().forEach(track => track.stop())
        return
      }
      stream.current = media
      preview.current.srcObject = media
      const recording = new MediaRecorder(media)
      const chunks = []
      recorder.current = recording
      recording.ondataavailable = event => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recording.onerror = () => {
        if (ticket !== request.current) return
        media.getTracks().forEach(track => track.stop())
        setError('The recording stopped unexpectedly. Try again or upload a recording.')
        setStatus('idle')
      }
      recording.onstop = () => {
        media.getTracks().forEach(track => track.stop())
        if (ticket !== request.current) return
        if (!chunks.length) {
          setError('The camera did not produce a recording. Try again.')
          setStatus('idle')
          return
        }
        const type = recording.mimeType || chunks[0].type
        const extension = type.includes('mp4') ? 'mp4' : 'webm'
        setDuration((performance.now() - startedAt) / 1000)
        setCapture(new File(chunks, `Camera recording.${extension}`, { type }))
        setStatus('preview')
      }
      recording.start()
      const startedAt = performance.now()
      setStatus('recording')
    } catch {
      media?.getTracks().forEach(track => track.stop())
      if (ticket !== request.current) return
      setError('The camera could not be started. Check camera access or upload a recording.')
      setStatus('idle')
    }
  }

  return <div className="camera-setup">
    <video ref={preview} playsInline muted autoPlay hidden={status !== 'recording'} aria-label="Live camera preview" />
    {url && <video src={url} playsInline controls aria-label="Recorded practice preview" />}
    {error && <p className="login-error" role="alert">{error}</p>}
    <div className="camera-actions">
      {status === 'recording' ? <button type="button" className="primary" onClick={() => {
        setStatus('processing')
        recorder.current.stop()
      }}>Stop recording</button> :
        <button type="button" className={capture ? 'secondary' : 'primary'} disabled={status === 'requesting' || status === 'processing'} onClick={start}>
          <Icon name="camera" />{status === 'requesting' ? 'Opening camera…' : capture ? 'Record again' : 'Start camera recording'}
        </button>}
      {capture && <button type="button" className="primary" onClick={() => onUse(capture, duration)}>Use this recording</button>}
    </div>
  </div>
}

export default function PracticeSetup({ dialog, Icon, onCreate }) {
  const [step, setStep] = useState(0)
  const [format, setFormat] = useState('')
  const [reviewMode, setReviewMode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const upload = useRef(null)
  const heading = useRef(null)

  useEffect(() => {
    if (dialog.current.open) heading.current?.focus()
  }, [step, dialog])

  function reset() {
    setStep(0)
    setFormat('')
    setReviewMode('')
    setName('')
    setError('')
  }

  function finish(file, duration) {
    onCreate(name.trim() || `${format} practice`, format, reviewMode, file, duration)
    dialog.current.close()
    reset()
  }

  const titles = ['Start a practice', `Choose a ${format.toLowerCase()} mode`, 'Add your practice video', 'Record your practice']
  const descriptions = [
    'Choose solo, partner, or group practice.',
    'Choose what you want to focus on in this review.',
    'Upload, record, or use a sample clip to start your practice.',
    'Record from your camera. This recording is video only.',
  ]

  return <dialog ref={dialog} className="create-dialog practice-setup" aria-labelledby="create-title" aria-describedby="create-description" onClose={reset}>
    <p className="eyebrow">New project</p>
    <h2 id="create-title" ref={heading} tabIndex={-1}>{titles[step]}</h2>
    <p id="create-description">{descriptions[step]}</p>
    <button type="button" className="login-close" onClick={() => { dialog.current.close(); reset() }} aria-label="Close practice setup">×</button>
    {step === 0 && <div className="setup-formats">
      {formats.map(item => <Option key={item.id} Icon={Icon} title={`${item.id} practice`} description={item.description} count={item.count} variant={item.id.toLowerCase()} onClick={() => { setFormat(item.id); setStep(1) }} />)}
    </div>}
    {step === 1 && <div className="setup-modes">
      {reviewModes[format].map(item => <Option key={item.id} Icon={Icon} {...item} onClick={() => { setReviewMode(item.id); setStep(2) }} />)}
    </div>}
    {step === 2 && <>
      <label className="project-name">Project name <input value={name} maxLength={70} onChange={event => setName(event.target.value)} placeholder={`${format} practice`} /></label>
      <div className="setup-sources">
        <Option Icon={Icon} icon="camera" title="Record now" description="Capture this practice with your camera." onClick={() => setStep(3)} />
        <Option Icon={Icon} icon="upload" title="Upload a recording" description="Choose a video from your device." onClick={() => upload.current.click()} />
        <Option Icon={Icon} icon="play" title="Use sample clip" description="Try a ready-made practice recording." variant="sample-option" onClick={() => finish(null)} />
      </div>
      <input ref={upload} type="file" accept="video/*,.mp4,.mov,.webm,.m4v,.ogv" hidden onChange={event => {
        const file = event.target.files?.[0]
        if (!file) return
        if (isVideo(file)) finish(file)
        else { setError('Choose a video file, such as an MP4 or MOV.'); event.target.value = '' }
      }} />
      {error && <p className="login-error" role="alert">{error}</p>}
    </>}
    {step === 3 && <Camera Icon={Icon} onUse={finish} />}
    {step > 0 && <button type="button" className="text-button setup-back" onClick={() => { setError(''); setStep(step - 1) }}><Icon name="arrow" size={15} /> Back</button>}
  </dialog>
}
