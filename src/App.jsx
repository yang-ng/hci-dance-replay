import { useEffect, useId, useRef, useState } from 'react'
import { demoAttempts, demoNotes, drawDemo } from './demo.js'
import { loadPractice, savePractice } from './storage.js'
import PracticeSetup, { isVideo } from './PracticeSetup.jsx'
import { referenceById, referenceClips } from './reference.js'
import AccountDialog from './AccountDialog.jsx'
import rehearsalPhoto from './assets/rehearsal.jpg'
import './styles.css'

const sampleDancers = ['Sam', 'Riley']
const speeds = [0.5, 0.75, 1, 1.5]
const modes = {
  Solo: ['You'],
  Partner: ['You', 'Partner'],
  Group: ['You', 'Dancer 2', 'Dancer 3'],
}
const sampleProject = { id: 'sample', name: 'Partner cue practice', mode: 'Partner', demo: true }
const demoPractice = { projects: [sampleProject], attempts: demoAttempts, notes: demoNotes }
const emptyPractice = { projects: [], attempts: [], notes: [] }

function restorePractice(saved) {
  if (saved.projects) return saved
  const uploads = saved.attempts.filter(attempt => !attempt.demo)
  if (!uploads.length) return { ...saved, projects: [sampleProject] }
  const previousProject = { id: 'previous', name: 'Your practice', mode: 'Partner', dancers: sampleDancers }
  return {
    ...saved,
    projects: [sampleProject, previousProject],
    attempts: saved.attempts.map(attempt => attempt.demo ? attempt : { ...attempt, projectId: previousProject.id }),
  }
}

function dancerColor(person) {
  if (person === 'Sam' || person === 'You') return 'sam'
  if (person === 'Dancer 3') return 'third'
  return 'riley'
}

const icons = {
  logo: <><path d="M3 12h3l2.5-7 4 14 3.5-9 2 2H21" /></>,
  play: <path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none" />,
  pause: <><path d="M9 5v14M15 5v14" strokeWidth="3" /></>,
  back: <><path d="M5 5v14m13-13-9 6 9 6z" /></>,
  forward: <><path d="M19 5v14M6 6l9 6-9 6z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" />,
  camera: <><rect x="3" y="6" width="18" height="15" rx="2" /><path d="m8 6 1-3h6l1 3" /><circle cx="12" cy="13" r="3" /></>,
  film: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 10h4m10 0h4M3 14h4m10 0h4" /></>,
  review: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4m-2-13 5 3-5 3z" /></>,
  cues: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2.5" fill="var(--icon-bg, white)" /><circle cx="15" cy="17" r="2.5" fill="var(--icon-bg, white)" /></>,
  compare: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M12 5v14" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  comment: <path d="M20 11a7 7 0 0 1-7 7H7l-4 3 1-6a7 7 0 0 1-1-4 7 7 0 0 1 7-7h3a7 7 0 0 1 7 7Z" />,
  summary: <path d="M5 20V11M12 20V4M19 20v-6" />,
  check: <path d="m5 12 5 5 9-10" />,
  loop: <path d="m16 2 4 4-4 4M4 11V9a3 3 0 0 1 3-3h13M8 22l-4-4 4-4m12-1v2a3 3 0 0 1-3 3H4" />,
}

function Icon({ name, size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
}

function timestamp(time) {
  const seconds = Math.floor(time)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function cueTimestamp(time) {
  const rounded = Math.round(time * 10)
  return `${timestamp(Math.floor(rounded / 10))}.${rounded % 10}`
}

const outcomes = [
  { id: 'aligned', label: 'Aligned' },
  { id: 'different', label: 'Different' },
]

// Self-review and Coach review save notes but don't generate a scored summary.
function hasScoredSummary(project) {
  return project.reviewMode !== 'self' && project.reviewMode !== 'coach'
}

// Only cues with a recorded outcome count toward the percentage.
function cueStats(notes) {
  const reviewed = notes.filter(note => note.outcome)
  const aligned = reviewed.filter(note => note.outcome === 'aligned').length
  return { total: notes.length, reviewed: reviewed.length, aligned, different: reviewed.length - aligned }
}

function alignedPercent(stats) {
  return stats.reviewed ? Math.round(stats.aligned / stats.reviewed * 100) : null
}

function OutcomePicker({ note, onChange }) {
  return <div className="outcome-picker" role="group" aria-label={`Outcome for ${note.dancer}'s cue at ${cueTimestamp(note.time)}`}>
    {outcomes.map(item => <button key={item.id} type="button" className={`outcome ${item.id}`} aria-pressed={note.outcome === item.id}
      onClick={() => onChange(note.outcome === item.id ? null : item.id)}>
      {note.outcome === item.id && <Icon name="check" size={14} />}{item.label}
    </button>)}
  </div>
}

function DancerLabel({ person }) {
  return <span className="dancer-label"><span className={`dot ${dancerColor(person)}`} />{person}</span>
}

function Player({ attempt, notes = [], seek, onTime, loop, shortcuts = false }) {
  const timelineId = useId()
  const video = useRef(null)
  const canvas = useRef(null)
  const [time, setTime] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(attempt.duration || 0)
  const [url, setUrl] = useState('')
  const clip = referenceById(attempt.referenceId)
  const videoUrl = url || clip?.src
  const [error, setError] = useState('')
  const position = useRef(0)

  useEffect(() => {
    if (!attempt.file) return
    const nextUrl = URL.createObjectURL(attempt.file)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [attempt.file])

  useEffect(() => {
    if (video.current) video.current.playbackRate = speed
  }, [speed, videoUrl])

  useEffect(() => {
    if (attempt.demo && canvas.current) drawDemo(canvas.current, time, attempt.id === 'demo-2')
  }, [attempt.demo, attempt.id, time])

  function move(next) {
    const bounded = Math.max(0, Math.min(next, duration))
    position.current = bounded
    if (video.current) video.current.currentTime = bounded
    setTime(bounded)
    onTime?.(bounded)
  }

  useEffect(() => {
    if (seek) move(seek.time)
  }, [seek, duration])

  useEffect(() => {
    if (!attempt.demo || !playing) return
    let request
    let previous
    function tick(now) {
      let next = position.current + (previous === undefined ? 0 : (now - previous) * speed / 1000)
      previous = now
      if (loop && next >= loop.end) next = loop.start
      move(next)
      if (next < duration) request = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [attempt.demo, playing, speed, duration, loop])

  function toggle() {
    if (attempt.demo) {
      if (!playing && position.current >= duration) move(loop?.start ?? 0)
      setPlaying(!playing)
    } else if (video.current?.paused) {
      video.current.play().catch(() => setError('Playback could not start. Try a video that plays in this browser.'))
    } else {
      video.current?.pause()
    }
  }

  function updateVideoTime(event) {
    const element = event.currentTarget
    if (loop && !element.paused && element.currentTime >= loop.end) element.currentTime = loop.start
    setTime(element.currentTime)
    onTime?.(element.currentTime)
  }

  const controls = useRef(null)
  useEffect(() => { controls.current = { toggle, move, now: () => attempt.demo ? position.current : video.current?.currentTime ?? 0 } })
  useEffect(() => {
    if (!shortcuts) return
    function onKey(event) {
      const target = event.target
      if (event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog[open]')) return
      if (target.closest?.('input, textarea, select, [contenteditable=true]')) return
      const { toggle: play, move: seekTo, now } = controls.current
      if (event.key === ' ' || event.key === 'k') {
        if (target.closest?.('button') && event.key === ' ') return
        event.preventDefault()
        play()
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const step = event.shiftKey ? 1 : 1 / 30
        seekTo(now() + (event.key === 'ArrowLeft' ? -step : step))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcuts])

  return (
    <section className="player" aria-label={`Video player for ${attempt.name}`}>
      <div className="stage">
        {attempt.demo ? <canvas ref={canvas} width="768" height="432" aria-label="Animated sample of two dancers practicing a cue" role="img" /> :
          <video ref={video} src={videoUrl} poster={clip?.poster} playsInline preload="metadata" onTimeUpdate={updateVideoTime}
            onLoadedMetadata={event => {
              const seconds = event.currentTarget.duration
              if (!Number.isFinite(seconds)) return
              setDuration(seconds)
            }}
            onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
            onError={() => setError('This video could not be opened. Try another video file.')} />}
        <div className="stage-caption">{attempt.demo ? 'Sample replay' : attempt.name}</div>
        {attempt.demo && <div className="stage-legend">{sampleDancers.map(person => <DancerLabel key={person} person={person} />)}</div>}
        {!playing && !error && <button className="stage-play" type="button" onClick={toggle} aria-label={`Play ${attempt.name}`}><Icon name="play" size={25} /></button>}
        {error && <p className="player-error" role="alert">{error}</p>}
      </div>
      <div className="transport">
        <div className="transport-controls">
          <button type="button" className="icon-btn" onClick={() => move(time - 1 / 30)} aria-label="Step back 1/30 second" title="Step back 1/30 second"><Icon name="back" /></button>
          <button type="button" className="play-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play'} /></button>
          <button type="button" className="icon-btn" onClick={() => move(time + 1 / 30)} aria-label="Step forward 1/30 second" title="Step forward 1/30 second"><Icon name="forward" /></button>
          <span className="time"><strong>{timestamp(time)}</strong> / {timestamp(duration)}</span>
        </div>
        {shortcuts && <span className="shortcut-hint" aria-hidden="true"><kbd>Space</kbd> play <kbd>←</kbd><kbd>→</kbd> frame</span>}
        <label className="speed">Speed <select aria-label="Playback speed" value={speed} onChange={event => setSpeed(Number(event.target.value))}>
          {speeds.map(value => <option key={value} value={value}>{value}×</option>)}
        </select></label>
      </div>
      <div className="timeline">
        <label className="sr-only" htmlFor={timelineId}>Scrub {attempt.name}</label>
        <div className="timeline-track">
        <input id={timelineId} className="scrubber" style={{ '--played': `${duration ? time / duration * 100 : 0}%` }} type="range"
          min="0" max={duration || 1} step="0.01" disabled={!duration} value={time} onChange={event => move(Number(event.target.value))} />
        {duration > 0 && <div className="timeline-markers" aria-hidden="true">
          {loop && <span className="loop-range" style={{ left: `${loop.start / duration * 100}%`, width: `${(loop.end - loop.start) / duration * 100}%` }} />}
          {notes.map(note => <span key={note.id} className={`dot ${dancerColor(note.dancer)}`} style={{ left: `${Math.min(note.time / duration, 1) * 100}%` }} />)}
        </div>}
        </div>
        <div className="timeline-ends" aria-hidden="true"><span>0:00</span><span>{timestamp(duration)}</span></div>
        {notes.length > 0 && <div className="cue-lane" aria-label="Timeline cues">{notes.map((note, index) =>
          <button key={note.id} type="button" className="cue-chip" onClick={() => move(note.time)} title={note.text}>
            <span className={`dot ${dancerColor(note.dancer)}`} />{cueTimestamp(note.time)}<span className="sr-only"> {note.dancer} cue {index + 1}</span>
          </button>
        )}</div>}
      </div>
    </section>
  )
}

function NoteForm({ dancer, time, draft, onSave, onClose }) {
  return <form className="note-form" onSubmit={event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const text = data.get('text').trim()
    if (text) onSave({ type: data.get('type'), text })
  }}>
    <div className="note-form-heading"><strong>{draft ? 'Edit cue' : `Add cue at ${cueTimestamp(time)}`}</strong><DancerLabel person={dancer} /></div>
    <label>Cue type<select name="type" defaultValue={draft?.type || 'Invitation'}>{['Invitation', 'Response', 'Closing', 'Other'].map(type => <option key={type}>{type}</option>)}</select></label>
    <label>What did you notice?<textarea autoFocus required maxLength={280} name="text" defaultValue={draft?.text} placeholder="e.g. I see the invitation here." rows="3" /></label>
    <div className="form-actions"><button className="secondary" type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit">Save cue</button></div>
  </form>
}

function CoachInvitation({ projectName }) {
  function openInvitation(event) {
    event.preventDefault()
    const email = new FormData(event.currentTarget).get('email').trim()
    const subject = encodeURIComponent('Dance Replay coach invitation')
    const body = encodeURIComponent(`Hi, would you be willing to review my dance practice “${projectName}” with me? We can watch the recording and leave feedback together on my device. Let me know when you’re available. Thanks!`)
    const recipient = encodeURIComponent(email).replace('%40', '@')
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`
  }

  return <details>
    <summary>Invite a coach</summary>
    <form className="note-form" onSubmit={openInvitation}>
      <p>Open an email draft to arrange a review together. Recordings and notes are saved on this device.</p>
      <label className="login-field">Coach’s email
        <input type="email" name="email" autoComplete="off" required />
      </label>
      <button type="submit" className="secondary">Open invitation draft</button>
    </form>
  </details>
}

function CueReview({ notes, people, dancer, time, onDancer, onJump, onSave, onDelete, coachProject }) {
  const [form, setForm] = useState(null)
  return <aside className="notes card">
    <div className="notes-header">
      <div className="notes-title"><span className="note-icon"><Icon name="comment" size={17} /></span><h2>{coachProject ? 'Coach feedback' : 'Cue notes'}</h2></div>
      <p>{coachProject ? 'Pause the recording to add timestamped feedback.' : 'Pause on a moment, then add a cue for whoever is reviewing.'}</p>
      {coachProject ? <CoachInvitation projectName={coachProject.name} /> : <div className="person-switch" aria-label="Who is reviewing">{people.map(person =>
        <button className={person === dancer ? 'selected' : ''} key={person} type="button" aria-pressed={person === dancer} onClick={() => { onDancer(person); setForm(null) }}><DancerLabel person={person} /></button>
      )}</div>}
      {!form && <button className="primary add-cue" type="button" onClick={() => setForm({ time })}><Icon name="plus" size={16} /> Add cue at {cueTimestamp(time)}</button>}
    </div>
    <div className="notes-body">
      {form && <NoteForm key={form.draft?.id || 'new'} dancer={dancer} time={form.time} draft={form.draft} onClose={() => setForm(null)} onSave={values => {
        onSave({ ...form.draft, ...values, time: form.time, id: form.draft?.id || crypto.randomUUID() })
        setForm(null)
      }} />}
      <div className="notes-meta"><span>{dancer}’s review</span><span>{notes.length} {notes.length === 1 ? 'cue' : 'cues'}</span></div>
      {notes.map(note => <article className={`note ${Math.abs(note.time - time) < 0.75 ? 'current' : ''}`} key={note.id}>
        <div className="note-top"><button className="note-time" type="button" onClick={() => onJump(note.time)} aria-label={`Jump to ${cueTimestamp(note.time)} ${note.type.toLowerCase()} cue`}><Icon name="play" size={14} />{cueTimestamp(note.time)}</button><span>{note.type}</span></div>
        <p>{note.text}</p>
        <div className="note-actions"><button type="button" aria-label={`Edit cue at ${cueTimestamp(note.time)}`} onClick={() => setForm({ draft: note, time: note.time })}>Edit</button><button type="button" aria-label={`Delete cue at ${cueTimestamp(note.time)}`} onClick={() => { onDelete(note.id); if (form?.draft?.id === note.id) setForm(null) }}>Delete</button></div>
      </article>)}
      {notes.length === 0 && !form && <p className="empty">No cues yet. Play or scrub the clip, then tap <strong>Add cue</strong>.</p>}
    </div>
  </aside>
}

function CueComparison({ attempt, notes, people, showOutcomes, onOutcome }) {
  const [cueIds, setCueIds] = useState({})
  const [secondDancer, setSecondDancer] = useState(people[1] || people[0])
  const [seek, setSeek] = useState(null)
  const [loop, setLoop] = useState(null)
  const participants = [people[0], secondDancer]
  const picked = participants.map((person, index) => {
    const options = notes.filter(note => note.dancer === person)
    return options.find(note => note.id === cueIds[index]) || options[person === participants[0] && index === 1 ? 1 : 0]
  })
  const bothSelected = picked.every(Boolean)
  const start = bothSelected ? Math.min(...picked.map(note => note.time)) : 0
  const end = bothSelected ? Math.max(...picked.map(note => note.time)) : 0
  const jump = time => setSeek({ time })
  return <div className="compare-layout">
    <div className="card video-card"><Player key={attempt.id} attempt={attempt} notes={notes} seek={seek} loop={loop} /></div>
    <aside className="card compare-panel">
      <h2>Compare cues</h2>
      <p>{people.length === 1 ? 'Choose two cues from this attempt.' : 'Choose one cue from each dancer in this attempt.'}</p>
      {participants.map((person, index) => {
        const note = picked[index]
        const options = notes.filter(item => item.dancer === person)
        return <div className="comparison-note" key={index}>
          {index === 1 && people.length > 2 ? <select aria-label="Second dancer" value={person} onChange={event => {
            setSecondDancer(event.target.value)
            setLoop(null)
          }}>{people.slice(1).map(dancer => <option key={dancer}>{dancer}</option>)}</select> : <DancerLabel person={person} />}
          {options.length > 0 ? <>
            <select aria-label={`${index === 0 ? 'First' : 'Second'} cue for ${person}`} value={note?.id || ''} onChange={event => {
              setCueIds({ ...cueIds, [index]: event.target.value })
              setLoop(null)
            }}>
              {!note && <option value="" disabled>Choose a cue</option>}
              {options.map(item => <option value={item.id} key={item.id}>{cueTimestamp(item.time)} · {item.type}</option>)}
            </select>
            {note && <>
              <p>{note.text}</p>
              <button className="text-button" type="button" onClick={() => { setLoop(null); jump(note.time) }}>Jump to cue <Icon name="arrow" size={15} /></button>
              {showOutcomes && <div className="comparison-outcome"><small>After you discuss it, mark this cue:</small><OutcomePicker note={note} onChange={outcome => onOutcome(note, outcome)} /></div>}
            </>}
          </> : <p>No cues yet. Add one in Private review.</p>}
        </div>
      })}
      {bothSelected && <div className="comparison-result">
        <strong>{(end - start).toFixed(1)}s apart</strong>
        {end > start && <button className="secondary" type="button" aria-pressed={Boolean(loop)} onClick={() => {
          if (loop) setLoop(null)
          else { setLoop({ start, end }); jump(start) }
        }}><Icon name="loop" size={16} />{loop ? 'Stop looping' : 'Loop between cues'}</button>}
        {loop && <small>Press play to replay the selected span.</small>}
      </div>}
    </aside>
  </div>
}

function AttemptComparison({ attempts, attempt, notes, onSelect, onUpload, canUpload }) {
  if (attempts.length < 2) return <div className="card compare-panel">
    <button className="primary" type="button" disabled={!canUpload} onClick={onUpload}><Icon name="upload" size={17} /> Add a second attempt</button>
    <p>Upload another clip to compare it with this attempt.</p>
  </div>
  return <div className="sync-compare">
    {onUpload && <div><button className="secondary" type="button" disabled={!canUpload} onClick={onUpload}><Icon name="upload" size={17} /> Add another attempt</button></div>}
    <section className="card video-card">
      <label className="attempt-selector">Attempt
        <select value={attempt.id} onChange={event => onSelect(event.target.value)}>
          {attempts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <Player key={attempt.id} attempt={attempt} notes={notes} />
    </section>
  </div>
}

function MetricCard({ title, stats }) {
  const value = alignedPercent(stats)
  return <article className="card metric">
    <h3>{title}</h3>
    {value === null ? <p className="metric-empty">No cues reviewed yet</p> : <>
      <p className="metric-value">{value}%<span> aligned</span></p>
      <p className="metric-detail">{stats.aligned} of {stats.reviewed} reviewed · <strong className={stats.different ? 'has-misunderstanding' : ''}>{stats.different} {stats.different === 1 ? 'misunderstanding' : 'misunderstandings'}</strong></p>
    </>}
    {stats.total > stats.reviewed && <p className="metric-detail">{stats.total - stats.reviewed} not reviewed</p>}
  </article>
}

const cueTypes = ['Invitation', 'Response', 'Closing', 'Other']

function ReviewSummary({ project, attempt, attempts, notes, allNotes, onReview, onOutcome, onFinish }) {
  const scored = hasScoredSummary(project)
  const types = cueTypes.filter(type => notes.some(note => note.type === type))
  return <div className="summary-layout">
    {scored ? <section className="summary-metrics" aria-label={`Cue outcomes for ${attempt.name}`}>
      <MetricCard title="All cues" stats={cueStats(notes)} />
      {types.map(type => <MetricCard key={type} title={`${type} cues`} stats={cueStats(notes.filter(note => note.type === type))} />)}
    </section> : <p className="status">{project.reviewMode === 'coach' ? 'Coach review' : 'Self-review'} saves your cue notes without an automatic summary.</p>}

    <section className="card summary-section">
      <h2>Reviewed moments</h2>
      <p>{scored ? 'Mark each cue after you talk it through. Cues you haven’t marked don’t count toward the percentages.' : 'Jump back to any moment you noted.'}</p>
      {notes.length === 0 ? <p className="empty">No cues on this attempt yet. Add them in Private review.</p> :
        <ol className="moment-list">{notes.map(note => <li key={note.id} className="moment">
          <div className="moment-meta"><span className="note-time static">{cueTimestamp(note.time)}</span><DancerLabel person={note.dancer} /><span className="moment-type">{note.type}</span></div>
          <p>{note.text}</p>
          <div className="moment-actions">
            {scored && <OutcomePicker note={note} onChange={outcome => onOutcome(note, outcome)} />}
            <button className="text-button" type="button" onClick={() => onReview(note)}>Review moment <Icon name="arrow" size={15} /></button>
          </div>
        </li>)}</ol>}
    </section>

    {scored && attempts.length > 1 && <section className="card summary-section">
      <h2>Across attempts</h2>
      <p>See whether your cues line up more often from one attempt to the next.</p>
      <table className="attempt-table">
        <thead><tr><th scope="col">Attempt</th><th scope="col">Cues</th><th scope="col">Reviewed</th><th scope="col">Aligned</th></tr></thead>
        <tbody>{attempts.map(item => {
          const stats = cueStats(allNotes.filter(note => note.attempt === item.id))
          const value = alignedPercent(stats)
          return <tr key={item.id} className={item.id === attempt.id ? 'current' : ''}>
            <th scope="row">{item.name}{item.id === attempt.id && <span className="sr-only"> (current)</span>}</th>
            <td>{stats.total}</td><td>{stats.reviewed}</td><td>{value === null ? '—' : `${value}%`}</td>
          </tr>
        })}</tbody>
      </table>
    </section>}

    <div className="summary-finish">
      {project.completed && <span className="complete-badge"><Icon name="check" size={14} /> Review complete</span>}
      <button className="primary" type="button" onClick={onFinish}><Icon name="check" size={16} /> Save &amp; finish</button>
    </div>
  </div>
}

const views = [
  { id: 'review', icon: 'review', label: 'Private review' },
  { id: 'cues', icon: 'cues', label: 'Compare cues' },
  { id: 'attempts', icon: 'compare', label: 'Compare attempts' },
  { id: 'reference', icon: 'film', label: 'Compare reference' },
  { id: 'summary', icon: 'summary', label: 'Summary' },
]

function ReferencePlayer({ clip }) {
  return <Player key={clip.id} attempt={{ id: clip.id, name: clip.name, referenceId: clip.id, duration: clip.duration }} />
}

function ReferenceLibrary() {
  const [clip, setClip] = useState(null)
  const dialog = useRef(null)

  return <section className="reference-library" aria-labelledby="reference-title">
    <div className="project-bar"><h2 id="reference-title">Reference dance clips</h2></div>
    <div className="project-grid">
      {referenceClips.map(item => <article className="reference-card" key={item.id}>
        <button type="button" className="reference-play" aria-label={`Open ${item.name}`} aria-haspopup="dialog" onClick={() => {
          setClip(item)
          dialog.current.showModal()
        }}>
          <img src={item.poster} alt="" loading="lazy" />
          <span className="reference-play-icon"><Icon name="play" size={21} /></span>
          <span className="reference-duration">{timestamp(item.duration)}</span>
        </button>
        <div className="reference-details"><h3>{item.name}</h3><p>{item.style}</p></div>
      </article>)}
    </div>
    <dialog ref={dialog} className="create-dialog reference-dialog" aria-labelledby="reference-clip-title" onClose={() => setClip(null)}>
      <h2 id="reference-clip-title">{clip?.name}</h2>
      <button className="login-close" type="button" aria-label="Close reference clip" onClick={() => dialog.current.close()}>×</button>
      {clip && <>
        <ReferencePlayer clip={clip} />
        <p className="reference-credit">Video by <a href={clip.source} target="_blank" rel="noreferrer">{clip.credit} on Pexels</a></p>
      </>}
    </dialog>
  </section>
}

const syncSpeeds = [0.5, 0.75, 1]

function finiteDuration(seconds) {
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
}

function useAttemptUrl(attempt) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!attempt.file) return
    const nextUrl = URL.createObjectURL(attempt.file)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [attempt.file])
  return attempt.file ? url : referenceById(attempt.referenceId)?.src || ''
}

// Keeps one video at the shared position. While playing, small drift is left alone so playback stays smooth.
function alignVideo(video, position, duration, live) {
  if (!video) return
  const ended = duration > 0 && position >= duration - 0.05
  if (Math.abs(video.currentTime - position) > (live ? 0.25 : 0.02)) video.currentTime = position
  if (live && !ended && video.paused) {
    video.play().catch(() => {
      video.muted = true
      video.play().catch(() => {})
    })
  }
  if ((!live || ended) && !video.paused) video.pause()
}

function StartCue({ label, value, max, onChange, cues = [] }) {
  const id = useId()
  return <div className="start-cue">
    <div className="start-cue-row">
      <label htmlFor={id}>{label}</label>
      <span className="start-cue-time">{cueTimestamp(value)}</span>
    </div>
    <div className="start-cue-row">
      <button type="button" className="icon-btn" onClick={() => onChange(value - 1 / 30)} aria-label={`Move ${label.toLowerCase()} back 1/30 second`}><Icon name="back" size={16} /></button>
      <input id={id} className="scrubber" type="range" min="0" max={max || 1} step="0.01" disabled={!max} value={value}
        style={{ '--played': `${max ? value / max * 100 : 0}%` }} onChange={event => onChange(Number(event.target.value))} />
      <button type="button" className="icon-btn" onClick={() => onChange(value + 1 / 30)} aria-label={`Move ${label.toLowerCase()} forward 1/30 second`}><Icon name="forward" size={16} /></button>
    </div>
    {cues.length > 0 && <div className="cue-lane"><span className="cue-lane-label">Use a cue:</span>{cues.map(note =>
      <button key={note.id} type="button" className="cue-chip" aria-pressed={Math.abs(value - note.time) < 0.01} onClick={() => onChange(note.time)}>
        <span className={`dot ${dancerColor(note.dancer)}`} />{cueTimestamp(note.time)}<span className="sr-only"> {note.dancer} {note.type}</span>
      </button>
    )}</div>}
  </div>
}

function ReferenceComparison({ attempt, notes, uploadOnly, onAlign, onUpload }) {
  // Start cues are saved on the attempt: one practice cue, plus one cue for each reference clip used.
  const saved = attempt.referenceAlign
  const [selected, setSelected] = useState(() => uploadOnly ? 'upload' :
    referenceById(saved?.clipId)?.id || referenceClips.find(clip => clip.id !== attempt.referenceId).id)
  const clip = referenceById(selected)
  const referenceFile = uploadOnly ? attempt.referenceFile : null
  const referenceUrl = useAttemptUrl({ file: referenceFile, referenceId: clip?.id })
  const practiceUrl = useAttemptUrl(attempt)
  const referenceInput = useRef(null)
  const [referenceError, setReferenceError] = useState('')
  const practiceVideo = useRef(null)
  const practiceCanvas = useRef(null)
  const referenceVideo = useRef(null)
  const [practiceDuration, setPracticeDuration] = useState(finiteDuration(attempt.duration))
  const [referenceDuration, setReferenceDuration] = useState(clip?.duration ?? 0)
  const [offsets, setOffsets] = useState(() => ({ practice: saved?.practice ?? 0, reference: saved?.reference?.[selected] ?? 0 }))
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const clock = useRef(0)
  const latest = useRef(null)
  const scrubberId = useId()
  // Shared time 0 = both clips at their start cues. The longer clip keeps playing; the shorter one holds its last frame.
  const span = Math.max(0, practiceDuration - offsets.practice, referenceDuration - offsets.reference)

  useEffect(() => {
    latest.current = { offsets, practiceDuration, referenceDuration, span, demo: attempt.demo, secondDemo: attempt.id === 'demo-2' }
  })

  function syncMedia(shared, live) {
    const state = latest.current
    if (!state) return
    const practicePosition = Math.min(state.offsets.practice + shared, state.practiceDuration || Infinity)
    const referencePosition = Math.min(state.offsets.reference + shared, state.referenceDuration || Infinity)
    if (state.demo) {
      if (practiceCanvas.current) drawDemo(practiceCanvas.current, practicePosition, state.secondDemo)
    } else alignVideo(practiceVideo.current, practicePosition, state.practiceDuration, live)
    alignVideo(referenceVideo.current, referencePosition, state.referenceDuration, live)
  }

  // Slider drags change cues many times a second, so saving waits until the cue settles.
  // A pending save is still written if the user leaves this tab first.
  const referenceCues = useRef({ ...saved?.reference })
  const pendingSave = useRef(null)
  const saveTimer = useRef(null)
  const saveAlignment = useRef(onAlign)
  useEffect(() => { saveAlignment.current = onAlign })

  function flushSave() {
    clearTimeout(saveTimer.current)
    if (pendingSave.current) saveAlignment.current?.(pendingSave.current)
    pendingSave.current = null
  }
  useEffect(() => flushSave, [])

  function rememberCues(nextOffsets, clipId) {
    referenceCues.current = { ...referenceCues.current, [clipId]: nextOffsets.reference }
    pendingSave.current = { clipId, practice: nextOffsets.practice, reference: referenceCues.current }
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(flushSave, 400)
  }

  useEffect(() => {
    if (!playing) syncMedia(time, false)
  }, [time, playing, offsets, practiceDuration, referenceDuration, practiceUrl, referenceUrl])

  useEffect(() => {
    for (const video of [practiceVideo.current, referenceVideo.current]) if (video) video.playbackRate = speed
  }, [speed, practiceUrl, referenceUrl])

  useEffect(() => {
    if (!playing) return
    let frame
    let previous
    function tick(now) {
      const end = latest.current.span
      const next = clock.current + (previous === undefined ? 0 : (now - previous) * speed / 1000)
      previous = now
      if (next >= end) {
        clock.current = end
        setTime(end)
        setPlaying(false)
        return
      }
      clock.current = next
      setTime(next)
      syncMedia(next, true)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed])

  function seek(next) {
    const bounded = Math.max(0, Math.min(next, latest.current?.span ?? span))
    clock.current = bounded
    setTime(bounded)
  }

  function toggle() {
    if (!playing && clock.current >= span) seek(0)
    setPlaying(!playing)
  }

  function setOffset(side, value, duration) {
    setPlaying(false)
    const next = { ...offsets, [side]: Math.max(0, Math.min(value, duration || value)) }
    setOffsets(next)
    rememberCues(next, selected)
    clock.current = 0
    setTime(0)
  }

  function chooseClip(id) {
    setPlaying(false)
    setSelected(id)
    setReferenceDuration(referenceById(id).duration)
    const next = { ...offsets, reference: referenceCues.current[id] ?? 0 }
    setOffsets(next)
    rememberCues(next, id)
    clock.current = 0
    setTime(0)
  }

  function uploadReference(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!isVideo(file)) {
      setReferenceError('Choose a video file, such as an MP4 or MOV.')
      return
    }

    flushSave()
    setReferenceError('')
    setPlaying(false)
    setReferenceDuration(0)
    setOffsets(current => ({ ...current, reference: 0 }))
    referenceCues.current = { ...referenceCues.current, upload: 0 }
    clock.current = 0
    setTime(0)
    onUpload(file, { clipId: selected, practice: offsets.practice, reference: referenceCues.current })
  }

  return <div className="sync-compare">
    <div className="attempt-comparison">
      <section className="card video-card">
        <div className="video-heading"><h2>Practice · {attempt.name}</h2><small>Muted</small></div>
        <div className="stage">
          {attempt.demo ? <canvas ref={practiceCanvas} width="768" height="432" role="img" aria-label="Animated sample of two dancers practicing a cue" /> :
            <video ref={practiceVideo} src={practiceUrl} muted playsInline preload="auto"
              onLoadedMetadata={event => { if (!finiteDuration(attempt.duration)) setPracticeDuration(finiteDuration(event.currentTarget.duration)) }} />}
          <div className="stage-caption">Practice</div>
        </div>
        <StartCue label="Practice start cue" value={offsets.practice} max={practiceDuration} cues={notes}
          onChange={value => setOffset('practice', value, practiceDuration)} />
      </section>
      <section className="card video-card">
        {uploadOnly ? <>
          <div className="video-heading"><h2>Reference clip</h2>{referenceFile && <small title={referenceFile.name}>{referenceFile.name}</small>}</div>
          <input ref={referenceInput} type="file" accept="video/*,.mp4,.mov,.webm,.m4v,.ogv" hidden onChange={uploadReference} />
          <div className={referenceFile ? undefined : 'empty-practice'}>
            {!referenceFile && <p>Upload a video to compare it with this attempt.</p>}
            <button className="secondary" type="button" onClick={() => referenceInput.current.click()}>
              <Icon name="upload" size={17} />{referenceFile ? 'Replace reference video' : 'Upload reference video'}
            </button>
          </div>
          {referenceError && <p className="status" role="status">{referenceError}</p>}
        </> : <label className="attempt-selector">Reference clip
          <select value={selected} onChange={event => chooseClip(event.target.value)}>
            {referenceClips.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>}
        {referenceUrl && <>
          <div className="stage">
            <video key={referenceUrl} ref={referenceVideo} src={referenceUrl} poster={clip?.poster} playsInline preload="auto"
              onLoadedMetadata={event => { const seconds = finiteDuration(event.currentTarget.duration); if (seconds) setReferenceDuration(seconds) }}
              onError={uploadOnly ? () => setReferenceError('This video could not be played. Try uploading another file.') : undefined} />
            <div className="stage-caption">Reference</div>
          </div>
          <StartCue label="Reference start cue" value={offsets.reference} max={referenceDuration}
            onChange={value => setOffset('reference', value, referenceDuration)} />
        </>}
        {clip && <p className="reference-credit">Video by <a href={clip.source} target="_blank" rel="noreferrer">{clip.credit} on Pexels</a></p>}
      </section>
    </div>

    {(!uploadOnly || referenceDuration > 0) && <section className="card sync-transport" aria-label="Shared playback controls">
      <div className="transport">
        <div className="transport-controls">
          <button type="button" className="icon-btn" onClick={() => { setPlaying(false); seek(time - 1 / 30) }} aria-label="Step both clips back 1/30 second"><Icon name="back" /></button>
          <button type="button" className="play-btn" onClick={toggle} aria-label={playing ? 'Pause both clips' : 'Play both clips'}><Icon name={playing ? 'pause' : 'play'} /></button>
          <button type="button" className="icon-btn" onClick={() => { setPlaying(false); seek(time + 1 / 30) }} aria-label="Step both clips forward 1/30 second"><Icon name="forward" /></button>
          <span className="time"><strong>+{cueTimestamp(time)}</strong> / {cueTimestamp(span)} from start cues</span>
        </div>
        <label className="speed">Speed <select aria-label="Playback speed for both clips" value={speed} onChange={event => setSpeed(Number(event.target.value))}>
          {syncSpeeds.map(value => <option key={value} value={value}>{value}×</option>)}
        </select></label>
      </div>
      <label className="sr-only" htmlFor={scrubberId}>Scrub both clips</label>
      <input id={scrubberId} className="scrubber" type="range" min="0" max={span || 1} step="0.01" disabled={!span} value={time}
        style={{ '--played': `${span ? time / span * 100 : 0}%` }} onChange={event => { setPlaying(false); seek(Number(event.target.value)) }} />
      <p className="sync-hint">Set a start cue on each clip to line up the same moment, then play. Start cues are saved with this attempt. Only the reference plays sound, and a shorter clip holds its last frame.</p>
    </section>}
  </div>
}

function projectDancers(project) {
  if (project.demo) return sampleDancers
  if (project.reviewMode === 'coach') return ['You', 'Coach']
  return project.dancers || modes[project.mode]
}

function AttemptThumbnail({ attempt }) {
  const url = useAttemptUrl(attempt)
  const clip = referenceById(attempt.referenceId)
  if (!attempt.file && clip) return <img src={clip.poster} alt="" loading="lazy" />
  if (!url) return null
  return <video src={`${url}#t=0.5`} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />
}

function ProjectCard({ project, attempts, cueCount, onOpen }) {
  const canvas = useRef(null)
  useEffect(() => {
    if (project.demo) drawDemo(canvas.current, 4.5, false)
  }, [project.demo])
  const cover = attempts[0]
  return <article className="project-card">
    <button type="button" className={`project-cover ${project.demo ? 'demo-cover' : ''}`} onClick={onOpen} tabIndex={-1} aria-hidden="true">
      {project.demo ? <canvas ref={canvas} width="768" height="432" /> : cover ? <AttemptThumbnail attempt={cover} /> : <Icon name="film" size={38} />}
      <span className="project-mode">{project.demo ? 'Sample · Partner' : project.mode}</span>
      {project.completed && <span className="complete-badge on-cover"><Icon name="check" size={13} /> Review complete</span>}
    </button>
    <div className="project-details">
      <h3>{project.name}</h3>
      <p>{attempts.length} {attempts.length === 1 ? 'attempt' : 'attempts'} · {cueCount} {cueCount === 1 ? 'cue' : 'cues'}</p>
      <button type="button" className="secondary" onClick={onOpen}>{project.completed ? 'Open review' : 'Continue reviewing'} <Icon name="arrow" size={16} /><span className="sr-only"> {project.name}</span></button>
    </div>
  </article>
}

export default function App() {
  const [profile, setProfile] = useState(null)
  return <Workspace key={profile?.id || 'demo'} profile={profile} onAccountLogin={setProfile} onSignOut={() => setProfile(null)} />
}

function Workspace({ profile, onAccountLogin, onSignOut }) {
  const [accountMode, setAccountMode] = useState('login')
  const [signingOut, setSigningOut] = useState(false)
  const accountId = profile?.id
  const initialPractice = profile ? emptyPractice : demoPractice
  const [practice, setPractice] = useState(initialPractice)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [deletedCue, setDeletedCue] = useState(null)
  const [page, setPage] = useState(profile ? 'dashboard' : 'welcome')
  const [projectId, setProjectId] = useState(sampleProject.id)
  const [activeId, setActiveId] = useState(null)
  const [view, setView] = useState('review')
  const [dancer, setDancer] = useState(sampleDancers[0])
  const [filter, setFilter] = useState('All')
  const [time, setTime] = useState(0)
  const [seek, setSeek] = useState(null)
  const pageHeading = useRef(null)
  const upload = useRef(null)
  const dialog = useRef(null)
  const login = useRef(null)
  const persisted = useRef(initialPractice)

  useEffect(() => {
    let active = true
    loadPractice(accountId).then(saved => {
      if (active && saved) {
        const restored = restorePractice(saved)
        persisted.current = restored
        setPractice(restored)
      }
    }).catch(() => {
      if (active) setMessage('Browser storage is unavailable. Changes may only last for this session.')
    }).finally(() => {
      if (active) setReady(true)
    })
    return () => { active = false }
  }, [accountId])

  useEffect(() => {
    if (!ready || persisted.current === practice) return
    let active = true
    savePractice(practice, accountId).catch(() => {
      if (active) setMessage('Your changes could not be saved on this device. Keep this tab open to continue this session.')
    })
    return () => { active = false }
  }, [practice, ready, accountId])

  useEffect(() => {
    if (page === 'welcome') return
    pageHeading.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [page])

  useEffect(() => {
    if (!signingOut) return
    // Give the review screen a commit to save any pending reference cue before switching workspaces.
    const exit = setTimeout(onSignOut, 0)
    return () => clearTimeout(exit)
  }, [signingOut, onSignOut])

  function openLogin() {
    setAccountMode('login')
    login.current.showModal()
  }

  const project = practice.projects.find(item => item.id === projectId) || sampleProject
  const participants = projectDancers(project)
  const projectAttempts = selected => practice.attempts.filter(attempt => selected.demo ? attempt.demo : attempt.projectId === selected.id)
  const group = projectAttempts(project)
  const attempt = group.find(item => item.id === activeId) || group[0]
  const attemptNotes = practice.notes.filter(note => note.attempt === attempt?.id).sort((a, b) => a.time - b.time)
  const solo = project.mode === 'Solo'
  const coachReview = view === 'coach'
  const reviewer = coachReview ? 'Coach' : dancer
  const dancerNotes = attemptNotes.filter(note => note.dancer === reviewer)
  const filtered = practice.projects.filter(item => filter === 'All' || item.mode === filter)

  function openProject(selected) {
    setProjectId(selected.id)
    setNotice('')
    setDancer(projectDancers(selected)[0])
    selectAttempt(null)
    if (selected.reviewMode === 'reference') setView('reference')
    if (selected.mode === 'Solo' && selected.reviewMode === 'coach') setView('coach')
    setPage('review')
  }

  function createProject(name, mode, reviewMode, file, duration) {
    const next = { id: crypto.randomUUID(), name, mode, reviewMode }
    const sampleId = mode === 'Solo' ? 'freestyle' : 'contemporary'
    const firstAttempt = {
      id: crypto.randomUUID(),
      projectId: next.id,
      name: 'Attempt 1',
      ...(file ? { file, duration } : { referenceId: sampleId }),
    }
    setPractice(current => ({
      ...current,
      projects: [...current.projects, next],
      attempts: [...current.attempts, firstAttempt],
    }))
    openProject(next)
  }

  function selectAttempt(id, nextView = 'review') {
    setActiveId(id)
    setSeek(null)
    setTime(0)
    setView(nextView)
  }

  function addVideo(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!isVideo(file)) {
      setMessage('Choose a video file, such as an MP4 or MOV.')
      return
    }
    const id = crypto.randomUUID()
    const next = { id, projectId: project.id, name: `Attempt ${group.length + 1}`, file }
    setPractice(current => ({ ...current, attempts: [...current.attempts, next] }))
    setMessage('')
    selectAttempt(id, view)
  }

  function updateCue(note) {
    const next = { ...note, attempt: attempt.id, dancer: reviewer }
    setPractice(current => ({
      ...current,
      notes: current.notes.some(item => item.id === next.id)
        ? current.notes.map(item => item.id === next.id ? next : item)
        : [...current.notes, next],
    }))
  }

  function deleteCue(id) {
    setDeletedCue(practice.notes.find(note => note.id === id) || null)
    setPractice(current => ({ ...current, notes: current.notes.filter(note => note.id !== id) }))
  }

  function undoDelete() {
    const note = deletedCue
    setDeletedCue(null)
    if (note) setPractice(current => ({ ...current, notes: [...current.notes, note] }))
  }

  useEffect(() => {
    if (!deletedCue) return
    const timer = setTimeout(() => setDeletedCue(null), 7000)
    return () => clearTimeout(timer)
  }, [deletedCue])

  function setOutcome(note, outcome) {
    setPractice(current => ({
      ...current,
      notes: current.notes.map(item => item.id === note.id ? { ...item, outcome } : item),
    }))
  }

  function reviewMoment(note) {
    const isCoachNote = solo && note.dancer === 'Coach'
    setView(isCoachNote ? 'coach' : 'review')
    if (!isCoachNote) setDancer(note.dancer)
    setSeek({ time: note.time })
    setTime(note.time)
  }

  function deleteProject() {
    if (project.demo || !ready) return
    if (!window.confirm(`Delete “${project.name}” and all its recordings and cue notes? This cannot be undone.`)) return

    setPractice(current => {
      const attemptIds = new Set(current.attempts.filter(item => item.projectId === project.id).map(item => item.id))
      return {
        ...current,
        projects: current.projects.filter(item => item.id !== project.id),
        attempts: current.attempts.filter(item => !attemptIds.has(item.id)),
        notes: current.notes.filter(note => !attemptIds.has(note.attempt)),
      }
    })
    setDeletedCue(null)
    setNotice('')
    setPage('dashboard')
  }

  function finishReview() {
    setPractice(current => ({
      ...current,
      projects: current.projects.map(item => item.id === project.id ? { ...item, completed: true, completedAt: Date.now() } : item),
    }))
    setNotice(`Review saved for “${project.name}”.`)
    setPage('dashboard')
  }

  function saveReferenceUpload(id, referenceFile, referenceAlign) {
    setPractice(current => ({
      ...current,
      attempts: current.attempts.map(item => item.id === id ? { ...item, referenceFile, referenceAlign } : item),
    }))
  }

  function saveAlignment(id, referenceAlign) {
    setPractice(current => ({
      ...current,
      attempts: current.attempts.map(item => item.id === id ? { ...item, referenceAlign } : item),
    }))
  }

  function changeView(id) {
    if (id === view) return
    setView(id)
    setSeek(null)
    setTime(0)
  }

  return (
    <div className={`app-shell page-${page}`}>
      <header className="site-header">
        <button className="brand" type="button" onClick={() => setPage('welcome')}><span className="brand-icon"><Icon name="logo" size={23} /></span><span>Dance <strong>Replay</strong></span></button>
        <div className="header-actions">
          <button className="header-projects" type="button" onClick={() => setPage('dashboard')} aria-current={page === 'dashboard' ? 'page' : undefined}>Projects <Icon name="arrow" size={16} /></button>
          {profile && <>
            <span className="account-name" title={profile.username}>{profile.username}</span>
            <button className="text-button sign-out" type="button" disabled={signingOut} onClick={() => { setPage('welcome'); setSigningOut(true) }}>Sign out</button>
          </>}
        </div>
      </header>

      {page === 'welcome' && <main className="welcome">
        <div className="welcome-content">
          <p className="eyebrow">Practice with perspective</p>
          <h1>See your practice from more angles</h1>
          <p className="welcome-description">Replay solo, partner, and group practice. Mark the moments that matter and see what changes on the next attempt.</p>
          <div className="welcome-actions">
            {profile ? <button type="button" className="primary" onClick={() => setPage('dashboard')}>Open workspace <Icon name="arrow" /></button> :
              <button type="button" className="primary" aria-haspopup="dialog" onClick={openLogin}>Log in <Icon name="arrow" /></button>}
            {!profile && <button type="button" className="text-button" onClick={() => openProject(sampleProject)}>Try the demo <Icon name="play" size={17} /></button>}
          </div>
        </div>
        <img className="welcome-image" src={rehearsalPhoto} alt="Three dancers rehearsing a contemporary phrase in a studio" width="1300" />
      </main>}

      {page === 'dashboard' && <main className="dashboard">
        <div className="dashboard-heading">
          <div><p className="eyebrow">Practice with perspective</p><h1 ref={pageHeading} tabIndex={-1}>Review your dance practice</h1></div>
          <p><Icon name="lock" size={16} /> Projects are saved on this device.</p>
        </div>
        {message && <div className="status" role="status">{message}</div>}
        {notice && <div className="status saved" role="status"><Icon name="check" size={16} /> {notice}</div>}
        <button className="start-practice" type="button" disabled={!ready} onClick={() => dialog.current.showModal()}>
          <span className="start-icon"><Icon name="plus" size={26} /></span>
          <span><strong>Start a practice</strong><small>Choose solo, partner, or group and add a recording.</small></span>
          <Icon name="arrow" size={22} />
        </button>
        <div className="project-bar"><h2>Your projects</h2>
          <div className="project-filters" aria-label="Filter projects">{['All', ...Object.keys(modes)].map(item =>
            <button type="button" aria-pressed={filter === item} key={item} onClick={() => setFilter(item)}>{item}</button>
          )}</div>
        </div>
        <div className="project-grid">
          {ready && filtered.map(item => {
            const attempts = projectAttempts(item)
            const ids = new Set(attempts.map(attempt => attempt.id))
            return <ProjectCard key={item.id} project={item} attempts={attempts} cueCount={practice.notes.filter(note => ids.has(note.attempt)).length} onOpen={() => openProject(item)} />
          })}
        </div>
        {ready && filtered.length === 0 && <p className="project-empty">No {filter.toLowerCase()} projects yet. Start a practice to add one.</p>}
        <ReferenceLibrary />
      </main>}

      {page === 'review' && <>
        <aside className="sidebar">
          <div className="sidebar-main">
            <button className="text-button back-projects" type="button" onClick={() => setPage('dashboard')}><Icon name="arrow" size={17} /> All projects</button>
          </div>
          <div className="sidebar-footer"><Icon name="lock" size={16} /><div><strong>On this device</strong><small>Videos and cue notes stay in this browser.</small></div></div>
        </aside>

        <main className="workspace">
          <input ref={upload} type="file" accept="video/*,.mp4,.mov,.webm,.m4v,.ogv" hidden onChange={addVideo} />
          <header className="workspace-header">
            <div className="page-title"><p className="eyebrow">{project.demo ? 'Sample practice' : `${project.mode} practice`}</p><h1 ref={pageHeading} tabIndex={-1}>{project.name}</h1><p>{project.demo ? 'Explore where two dancers notice the same cue.' : 'Review a clip, mark your cues, and compare attempts.'}</p></div>
            {!project.demo && <button type="button" className="secondary" disabled={!ready} onClick={deleteProject}>Delete project</button>}
          </header>
          {message && <div className="status" role="status">{message}</div>}
          {!attempt ? <section className="card empty-practice">
            <span className="start-icon"><Icon name="film" size={24} /></span>
            <h2>Add your first attempt</h2><p>Choose a recording to start reviewing your practice.</p>
            <button className="primary" type="button" onClick={() => upload.current.click()}><Icon name="upload" size={17} /> Choose video</button>
          </section> : <>
            <nav className="views" aria-label="Review views">{views.map(tab => solo && tab.id === 'cues' ? { id: 'coach', icon: 'comment', label: 'Coach reviews' } : tab).map(tab =>
              <button type="button" className={view === tab.id ? 'active' : ''} aria-current={view === tab.id ? 'page' : undefined} key={tab.id} onClick={() => changeView(tab.id)}><Icon name={tab.icon} size={17} /><span>{tab.label}</span></button>
            )}</nav>
            {group.length > 1 && view !== 'attempts' && <label className="attempt-selector">Attempt
              <select value={attempt.id} onChange={event => selectAttempt(event.target.value, view)}>
                {group.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>}
            {(view === 'review' || coachReview) && <div className="review-layout" key={view}>
              <div className="card video-card">
                <div className="video-heading"><h2>{attempt.name}</h2>{attempt.file && <small title={attempt.file.name}>{attempt.file.name}</small>}</div>
                <Player key={attempt.id} attempt={attempt} notes={dancerNotes} seek={seek} onTime={setTime} shortcuts />
              </div>
              <CueReview key={attempt.id} notes={dancerNotes} people={participants} dancer={reviewer} time={time} onDancer={setDancer} onJump={time => setSeek({ time })} onSave={updateCue}
                coachProject={coachReview ? project : null}
                onDelete={deleteCue} />
            </div>}
            {view === 'cues' && <CueComparison key={attempt.id} attempt={attempt} notes={attemptNotes} people={participants} showOutcomes={hasScoredSummary(project)} onOutcome={setOutcome} />}
            {view === 'summary' && <ReviewSummary project={project} attempt={attempt} attempts={group} notes={attemptNotes} allNotes={practice.notes} onReview={reviewMoment} onOutcome={setOutcome} onFinish={finishReview} />}
            {view === 'reference' && <ReferenceComparison key={attempt.id} attempt={attempt} notes={attemptNotes} uploadOnly={solo}
              onAlign={alignment => saveAlignment(attempt.id, alignment)}
              onUpload={(file, alignment) => saveReferenceUpload(attempt.id, file, alignment)} />}
            {view === 'attempts' && <AttemptComparison attempts={group} attempt={attempt} notes={attemptNotes}
              onSelect={id => selectAttempt(id, 'attempts')} onUpload={project.demo ? undefined : () => upload.current.click()} canUpload={ready && !project.demo} />}
          </>}
        </main>
      </>}
      {deletedCue && <div className="toast" role="status">Cue at {cueTimestamp(deletedCue.time)} deleted <button type="button" onClick={undoDelete}>Undo</button></div>}
      <AccountDialog dialog={login} mode={accountMode} onModeChange={setAccountMode} onContinue={account => {
        if (account) onAccountLogin(account)
        else setPage('dashboard')
      }} />
      <PracticeSetup dialog={dialog} Icon={Icon} onCreate={createProject} />
    </div>
  )
}
