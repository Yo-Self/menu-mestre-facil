// Função para gerar um som de notificação simples
function createNotificationSound() {
  console.log('🔊 Função global createNotificationSound chamada');
  
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Resumir contexto se estiver suspenso (necessário para autoplay)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Som mais audível e notável
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.3);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.4);
    
    // Volume mais alto
    gainNode.gain.setValueAtTime(0.6, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    console.log('✅ Som global tocado com sucesso');
  } catch (error) {
    console.error('❌ Erro na função global createNotificationSound:', error);
  }
}

// Exportar para uso global
window.createNotificationSound = createNotificationSound;
