export const demoAttempts = [
  { id: 'demo-1', name: 'Attempt 1', duration: 20, demo: true },
  { id: 'demo-2', name: 'Attempt 2', duration: 20, demo: true },
]

export const demoNotes = [
  { id: 'cue-1', attempt: 'demo-1', dancer: 'Sam', time: 4.5, type: 'Invitation', text: 'I offer my hand here to start the turn.', outcome: 'different' },
  { id: 'cue-2', attempt: 'demo-1', dancer: 'Riley', time: 6, type: 'Invitation', text: 'This is where I notice the invitation.', outcome: 'different' },
  { id: 'cue-3', attempt: 'demo-1', dancer: 'Sam', time: 12, type: 'Closing', text: 'I settle my weight to close the phrase.' },
  { id: 'cue-4', attempt: 'demo-2', dancer: 'Sam', time: 4.5, type: 'Invitation', text: 'Holding the gesture a little longer.', outcome: 'aligned' },
  { id: 'cue-5', attempt: 'demo-2', dancer: 'Riley', time: 5, type: 'Invitation', text: 'I notice the gesture earlier this time.', outcome: 'aligned' },
]

function dancer(ctx, x, y, phase, facing, color, reach) {
  const sway = Math.sin(phase)
  const hip = [x + 10 * sway, y - 75]
  const shoulder = [hip[0] + facing * 7, y - 145]
  const head = [shoulder[0] + facing * 4, y - 171]

  const line = (points, width, stroke) => {
    ctx.beginPath()
    ctx.moveTo(...points[0])
    points.slice(1).forEach(point => ctx.lineTo(...point))
    ctx.lineWidth = width
    ctx.strokeStyle = stroke
    ctx.stroke()
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.fillStyle = '#0d211b'
  ctx.beginPath()
  ctx.ellipse(x, y + 2, 58, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  line([hip, [x - 18, y - 39], [x - 30 + 10 * sway, y]], 14, color)
  line([hip, [x + 21, y - 40], [x + 32 - 10 * sway, y]], 14, color)
  line([hip, shoulder], 26, color)
  line([shoulder, [shoulder[0] - facing * 29, y - 112], [shoulder[0] - facing * 46, y - 125 - 10 * sway]], 11, color)
  line([shoulder, [shoulder[0] + facing * 32, y - 122], [shoulder[0] + facing * (42 + reach * 26), y - 105 - reach * 35]], 11, color)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(...head, 15, 0, Math.PI * 2)
  ctx.fill()
}

export function drawDemo(canvas, time, secondAttempt) {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const light = ctx.createRadialGradient(width / 2, 153, 24, width / 2, 200, 420)
  light.addColorStop(0, '#234a41')
  light.addColorStop(1, '#112a25')
  ctx.fillStyle = light
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#f4f8e912'
  ctx.beginPath()
  ctx.ellipse(width / 2, height - 86, 273, 46, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#b6ddcc18'
  ctx.lineWidth = 1
  for (let x = 32; x < width; x += 32) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let y = 32; y < height; y += 32) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  const signal = center => Math.exp(-((time - center) ** 2) / 2.2)
  const phase = time * Math.PI
  const step = 19 * Math.sin(time * 1.3)
  dancer(ctx, width / 2 - 92 + step, height - 81, phase, 1, '#ffab99', signal(4.5))
  dancer(ctx, width / 2 + 92 - step, height - 81, phase + 1.3, -1, '#89d2bf', signal(secondAttempt ? 5 : 6))
}
