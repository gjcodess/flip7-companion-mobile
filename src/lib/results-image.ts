import type { BankerPlayer, BankerRoundResult } from '../game/bankerGame'
import { playerAvatarSrc } from './player-avatars'

const ink = '#132d67'
const paper = '#fff9df'
const yellow = '#ffe05c'
const pink = '#ed4f7e'
const width = 1080

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number, fill: string, stroke = ink) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, radius)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = stroke
  ctx.stroke()
}

function dots(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color = '#132d6724') {
  ctx.fillStyle = color
  for (let dotY = y; dotY < y + h; dotY += 20) {
    for (let dotX = x; dotX < x + w; dotX += 20) {
      ctx.beginPath()
      ctx.arc(dotX, dotY, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function fitText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (ctx.measureText(value).width <= maxWidth) return value
  let result = value
  while (result && ctx.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1)
  return `${result}…`
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

export function resultsShareText(roomName: string, players: BankerPlayer[], targetScore: number) {
  const ordered = [...players].sort((a, b) => b.totalScore - a.totalScore)
  const leaders = ordered.filter(player => player.totalScore === ordered[0]?.totalScore).map(player => player.name)
  return `Flip7 Companion · ${roomName}\n${leaders.join(' & ')} ${leaders.length === 1 ? 'won with' : 'tied at'} ${ordered[0]?.totalScore ?? 0} points (first to ${targetScore}).\n${ordered.map(player => `${ordered.findIndex(entry => entry.totalScore === player.totalScore) + 1}. ${player.name} — ${player.totalScore} pts`).join('\n')}`
}

export async function createResultsImage(roomName: string, players: BankerPlayer[], history: BankerRoundResult[], targetScore: number): Promise<Blob> {
  const ordered = [...players].sort((a, b) => b.totalScore - a.totalScore)
  const leaders = ordered.filter(player => player.totalScore === ordered[0]?.totalScore)
  const rowHeight = 110
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = 585 + ordered.length * rowHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create the results image on this device.')
  await document.fonts?.ready

  ctx.fillStyle = '#f8ecc7'
  ctx.fillRect(0, 0, width, canvas.height)
  dots(ctx, 10, 10, width, canvas.height, '#132d6718')
  const [logo, ...avatars] = await Promise.all([
    loadImage('/assets/flip7-title-logo.webp'),
    ...ordered.map(player => loadImage(playerAvatarSrc(player.avatar, player.id))),
  ])
  if (logo) ctx.drawImage(logo, 56, 33, 300, 107)
  else { ctx.font = '900 55px Inter, sans-serif'; ctx.fillStyle = ink; ctx.fillText('FLIP7', 56, 102) }
  ctx.textAlign = 'right'
  ctx.fillStyle = ink
  ctx.font = '900 22px Inter, sans-serif'
  ctx.fillText('GAME NIGHT RESULTS', 1024, 87)
  ctx.textAlign = 'left'

  roundedRect(ctx, 61, 173, 972, 219, 28, ink)
  roundedRect(ctx, 52, 164, 972, 219, 28, yellow)
  dots(ctx, 820, 184, 180, 175)
  ctx.fillStyle = pink
  ctx.font = '900 22px Inter, sans-serif'
  ctx.fillText('MATCH COMPLETE', 90, 218)
  ctx.fillStyle = ink
  ctx.font = '900 54px Inter, sans-serif'
  ctx.fillText(fitText(ctx, roomName, 875), 90, 281)
  ctx.font = '600 25px Inter, sans-serif'
  const result = leaders.length === 1 ? `${leaders[0].name} won with ${leaders[0].totalScore} points` : `${leaders.map(player => player.name).join(' & ')} tied at ${leaders[0]?.totalScore ?? 0} points`
  ctx.fillText(fitText(ctx, result, 875), 90, 325)
  ctx.font = '800 20px Inter, sans-serif'
  ctx.fillText(`FIRST TO ${targetScore}   ·   ${history.length} ${history.length === 1 ? 'ROUND' : 'ROUNDS'}   ·   ${ordered.length} ${ordered.length === 1 ? 'PLAYER' : 'PLAYERS'}`, 90, 354)

  const cardY = 422
  const cardHeight = 115 + ordered.length * rowHeight
  roundedRect(ctx, 61, cardY + 9, 972, cardHeight, 28, ink)
  roundedRect(ctx, 52, cardY, 972, cardHeight, 28, paper)
  dots(ctx, 790, cardY + 15, 210, 135)
  ctx.fillStyle = pink
  ctx.font = '900 20px Inter, sans-serif'
  ctx.fillText('FINAL SCORES', 87, cardY + 46)
  ctx.fillStyle = ink
  ctx.font = '900 34px Inter, sans-serif'
  ctx.fillText('Game results', 87, cardY + 82)

  ordered.forEach((player, index) => {
    const y = cardY + 104 + index * rowHeight
    const rank = ordered.findIndex(entry => entry.totalScore === player.totalScore) + 1
    const winner = rank === 1
    roundedRect(ctx, 88, y + 5, 899, 93, 17, ink)
    roundedRect(ctx, 83, y, 899, 93, 17, winner ? yellow : '#fffdf5')
    roundedRect(ctx, 100, y + 27, 38, 38, 9, winner ? pink : '#dceef0')
    ctx.fillStyle = winner ? '#fffdf5' : ink
    ctx.textAlign = 'center'
    ctx.font = '900 22px Inter, sans-serif'
    ctx.fillText(String(rank), 119, y + 54)
    ctx.textAlign = 'left'
    roundedRect(ctx, 155, y + 15, 62, 62, 14, player.color)
    if (avatars[index]) {
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(158, y + 18, 56, 56, 11)
      ctx.clip()
      ctx.drawImage(avatars[index], 158, y + 18, 56, 56)
      ctx.restore()
    }
    ctx.fillStyle = ink
    ctx.font = '900 28px Inter, sans-serif'
    ctx.fillText(fitText(ctx, player.name, 520), 238, y + 45)
    ctx.fillStyle = '#53607a'
    ctx.font = '700 18px Inter, sans-serif'
    ctx.fillText(winner ? 'WINNER' : 'FINAL SCORE', 239, y + 72)
    ctx.fillStyle = ink
    ctx.font = '900 43px Inter, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(String(player.totalScore), 951, y + 57)
    ctx.font = '700 16px Inter, sans-serif'
    ctx.fillText('PTS', 951, y + 77)
    ctx.textAlign = 'left'
  })

  ctx.fillStyle = ink
  ctx.font = '800 17px Inter, sans-serif'
  ctx.fillText('FLIP7 COMPANION  ·  THE PHONE CONTROLS THE GAME', 56, canvas.height - 21)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not save the results image.')), 'image/png'))
}
