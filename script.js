// JavaScript для Telegram Mini-App

document.addEventListener('DOMContentLoaded', function() {
    // Инициализация приложения
    console.log('App loaded');

    // Обработчики кнопок
    const btnAdd = document.querySelector('.btn-add');
    const btnNotification = document.querySelector('.btn-notification');

    if (btnAdd) {
        btnAdd.addEventListener('click', function() {
            console.log('Add balance clicked');
        });
    }

    if (btnNotification) {
        btnNotification.addEventListener('click', function() {
            console.log('Notifications clicked');
        });
    }

    // Обработчик нижней навигации
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Удаляем active класс со всех пунктов
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Добавляем active класс текущему пункту
            this.classList.add('active');
            
            console.log('Nav item clicked:', this.querySelector('.nav-label').textContent);
        });
    });
});
