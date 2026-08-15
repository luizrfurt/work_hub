import type { Message } from '../types'

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) {
    return null
  }
  if (!audioContext) {
    audioContext = new AudioCtx()
  }
  return audioContext
}

export function unlockAudio(): void {
  const context = getAudioContext()
  if (context?.state === 'suspended') {
    void context.resume()
  }
}

export function playMessageSound(): void {
  const context = getAudioContext()
  if (!context) {
    return
  }
  if (context.state === 'suspended') {
    void context.resume()
  }
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(880, context.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.12)
  gain.gain.setValueAtTime(0.07, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.22)
}

export function requestNotificationPermission(): void {
  if (!('Notification' in window)) {
    return
  }
  if (Notification.permission === 'default') {
    void Notification.requestPermission()
  }
}

export function isChatTab(activeTab: string): boolean {
  return activeTab === 'chat'
}

export function isViewingConversation(activeTab: string): boolean {
  return isChatTab(activeTab) && !document.hidden
}

export function notifyIncomingMessage(projectName: string, message: Message): void {
  playMessageSound()
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return
  }
  const body = message.content?.trim() || (message.attachments.length > 0 ? 'Enviou um anexo' : 'Nova mensagem')
  try {
    const notification = new Notification(`${message.author_name} · ${projectName}`, {
      body,
      tag: `project-${message.project_id}`,
      silent: true,
    })
    notification.onclick = () => {
      window.focus()
      window.location.assign(`/projects/${message.project_id}`)
      notification.close()
    }
  } catch {
    // some browsers block notifications outside a user gesture
  }
}
