/** Regra de reprodução do feed: entrou no foco, começa do zero; saiu, pausa. */
export function syncMenuVideoPlayback(video: HTMLVideoElement, visible: boolean) {
  if (visible) {
    video.currentTime = 0;
    void video.play().catch(() => {
      // Alguns navegadores bloqueiam reprodução fora dos critérios de mídia.
    });
  } else {
    video.pause();
  }
}
