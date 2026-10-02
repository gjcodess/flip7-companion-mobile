import { Capacitor, registerPlugin } from '@capacitor/core'
import type { BankerPlayer, BankerRoundResult } from '../game/bankerGame'
import { createResultsImage, resultsShareText } from './results-image'

type ResultsImagePlugin = {
  shareImage(options: { dataUrl: string; fileName: string; text: string }): Promise<void>
  saveImage(options: { dataUrl: string; fileName: string }): Promise<{ location: string }>
}

const nativeResultsImage = registerPlugin<ResultsImagePlugin>('ResultsImage')

function fileNameFor(roomName: string) {
  const slug = roomName.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'room'
  return `flip7-${slug}-${new Date().toISOString().slice(0, 10)}.png`
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not prepare the results image.'))
    reader.onerror = () => reject(new Error('Could not prepare the results image.'))
    reader.readAsDataURL(blob)
  })
}

type Results = { roomName: string; players: BankerPlayer[]; history: BankerRoundResult[]; targetScore: number }

export async function shareGameResults({ roomName, players, history, targetScore }: Results) {
  const image = await createResultsImage(roomName, players, history, targetScore)
  const fileName = fileNameFor(roomName)
  const text = resultsShareText(roomName, players, targetScore)
  if (Capacitor.getPlatform() === 'android') {
    await nativeResultsImage.shareImage({ dataUrl: await blobDataUrl(image), fileName, text })
    return 'Share options opened.'
  }
  const file = new File([image], fileName, { type: 'image/png' })
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: `${roomName} · Flip7 results`, text, files: [file] })
    return 'Results shared.'
  }
  if (navigator.share) {
    await navigator.share({ title: `${roomName} · Flip7 results`, text })
    return 'Results shared as text.'
  }
  if (!navigator.clipboard?.writeText) throw new Error('Sharing is unavailable in this browser. Save the image and send it from your files instead.')
  await navigator.clipboard.writeText(text)
  return 'Results copied. Paste them into a message to share.'
}

export async function saveGameResults({ roomName, players, history, targetScore }: Results) {
  const image = await createResultsImage(roomName, players, history, targetScore)
  const fileName = fileNameFor(roomName)
  if (Capacitor.getPlatform() === 'android') {
    const result = await nativeResultsImage.saveImage({ dataUrl: await blobDataUrl(image), fileName })
    return `Image saved to ${result.location}.`
  }
  const url = URL.createObjectURL(image)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'Image download started.'
}
