// Função para tocar o som de notificação do restaurante
function createNotificationSound() {
  console.log('🔊 Função global createNotificationSound chamada');
  
  try {
    // Criar elemento de áudio
    const audio = new Audio('/restaurant-bell.mp3');
    
    // Configurar volume
    audio.volume = 0.8;
    
    // Tocar o som
    audio.play().then(() => {
      console.log('✅ Som do restaurante tocado com sucesso');
    }).catch((error) => {
      console.error('❌ Erro ao tocar o som do restaurante:', error);
    });
    
  } catch (error) {
    console.error('❌ Erro na função global createNotificationSound:', error);
  }
}

// Exportar para uso global
window.createNotificationSound = createNotificationSound;
