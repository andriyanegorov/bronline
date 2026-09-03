// JavaScript для Telegram Mini-App

document.addEventListener('DOMContentLoaded', function() {
    const btnAdd = document.querySelector('.btn-add');
    const btnNotification = document.querySelector('.btn-notification');
    const donateAddButton = document.querySelector('.nav-item-add');

    if (btnAdd) {
        btnAdd.addEventListener('click', function() {
            showPage('donate');
        });
    }

    if (donateAddButton) {
        donateAddButton.addEventListener('click', function() {
            showPage('donate');
        });
    }

    if (btnNotification) {
        btnNotification.addEventListener('click', function() {
            console.log('Notifications clicked');
        });
    }

    const topupOptions = document.querySelectorAll('.topup-option');
    topupOptions.forEach(option => {
        option.addEventListener('click', function() {
            topupOptions.forEach(item => {
                item.classList.remove('selected');
                item.setAttribute('aria-pressed', 'false');
            });

            this.classList.add('selected');
            this.setAttribute('aria-pressed', 'true');
        });
    });

    const premiumPlans = document.querySelectorAll('.premium-plan');
    premiumPlans.forEach(plan => {
        plan.addEventListener('click', function() {
            premiumPlans.forEach(item => {
                item.classList.remove('selected');
                item.setAttribute('aria-pressed', 'false');
            });

            this.classList.add('selected');
            this.setAttribute('aria-pressed', 'true');
        });
    });

    const caseCards = document.querySelectorAll('.case-card');
    const openCaseButtons = document.querySelectorAll('.btn-open');
    const caseDetailBack = document.querySelector('.case-back-btn');
    const openCounts = document.querySelectorAll('.open-count');
    const quickToggle = document.querySelector('.quick-toggle');
    const openingOverlay = document.querySelector('.case-opening-overlay');
    const openCaseButton = document.querySelector('.open-case-btn');
    const openingClose = document.querySelector('.opening-close');
    const reelWindow = document.querySelector('.reel-window');
    const reelTrack = document.querySelector('.reel-track');
    let reelAnimationFrame;
    let reelPosition = 0;
    let reelVelocity = 0;
    let reelLastTime = 0;
    let reelDragging = false;
    let reelPointerX = 0;
    let reelPointerTime = 0;
    let reelStartTime = 0;
    let reelStartPosition = 0;
    let reelTargetPosition = 0;
    let reelIsRunning = false;
    let reelPrepared = false;
    const openingProgress = document.querySelector('.opening-progress span');
    const openingStatus = document.querySelector('.opening-status');
    const dropResultModal = document.querySelector('.drop-result-modal');
    const dropResultClose = document.querySelector('.drop-result-close');
    const dropResultImage = document.getElementById('drop-result-image');
    const dropResultName = document.getElementById('drop-result-name');
    const dropResultPrice = document.getElementById('drop-result-price');
    const dropResultSell = document.querySelector('.drop-sell-btn');
    const reelDrops = [
        { name: 'BMW M5 F90', price: 12500, image: './data/assets/items/m5f90.png', alt: 'BMW M5 F90', rarity: 'red' },
        { name: 'M9 Bayonet Crimson Web', price: 8750, image: './data/assets/items/m5f90.png', alt: 'M9 Bayonet Crimson Web', rarity: 'red' },
        { name: 'Sport Gloves Blood Pressure', price: 7250, image: './data/assets/items/m5f90.png', alt: 'Sport Gloves Blood Pressure', rarity: 'red' },
        { name: 'AK-47 Bloodsport', price: 3250, image: './data/assets/items/m5f90.png', alt: 'AK-47 Bloodsport', rarity: 'orange' },
        { name: 'AWP Redline', price: 2750, image: './data/assets/items/m5f90.png', alt: 'AWP Redline', rarity: 'purple' }
    ];
    let resultDrop = null;

    function openCaseDetail(event) {
        event.preventDefault();
        showPage('case-detail');
    }

    caseCards.forEach(card => card.addEventListener('click', openCaseDetail));
    openCaseButtons.forEach(button => button.addEventListener('click', openCaseDetail));

    if (caseDetailBack) {
        caseDetailBack.addEventListener('click', function() {
            showPage('home');
        });
    }

    openCounts.forEach(count => {
        count.addEventListener('click', function() {
            openCounts.forEach(item => {
                item.classList.remove('selected');
                item.setAttribute('aria-pressed', 'false');
            });

            this.classList.add('selected');
            this.setAttribute('aria-pressed', 'true');
        });
    });

    if (quickToggle) {
        quickToggle.addEventListener('click', function() {
            const isPressed = this.getAttribute('aria-pressed') === 'true';
            this.setAttribute('aria-pressed', String(!isPressed));
        });
    }

    function setReelPosition(position) {
        reelPosition = position;
        reelTrack.style.transform = `translate3d(${position}px, 0, 0)`;
    }

    function showResultModal(drop) {
        if (!drop || !dropResultModal || !dropResultImage || !dropResultName || !dropResultPrice) return;

        dropResultImage.src = drop.image;
        dropResultImage.alt = drop.alt;
        dropResultName.textContent = drop.name;
        dropResultPrice.textContent = `${Number(drop.price).toLocaleString('ru-RU')} BC`;

        if (dropResultSell) {
            dropResultSell.textContent = `ПРОДАТЬ ЗА ${Number(drop.price).toLocaleString('ru-RU')} BC`;
        }

        dropResultModal.classList.add('active');
        dropResultModal.setAttribute('aria-hidden', 'false');
    }

    function hideResultModal() {
        if (!dropResultModal) return;
        dropResultModal.classList.remove('active');
        dropResultModal.setAttribute('aria-hidden', 'true');
    }

    function prepareReel() {
        const sourceItems = Array.from(reelTrack.children).map(item => item.cloneNode(true));
        reelTrack.replaceChildren();

        const winnerIndex = Math.floor(Math.random() * Math.min(sourceItems.length, reelDrops.length));
        resultDrop = reelDrops[winnerIndex];

        for (let repeat = 0; repeat < 5; repeat += 1) {
            sourceItems.forEach((sourceItem, itemIndex) => {
                const item = sourceItem.cloneNode(true);
                item.classList.remove('reel-winner');
                if (repeat === 2 && itemIndex === winnerIndex) item.classList.add('reel-winner');
                reelTrack.appendChild(item);
            });
        }

        reelPrepared = true;
    }

    function animateReel(time) {
        const elapsed = Math.min((time - reelStartTime) / 1000, 9.8);
        const accelerationTime = 0.9;
        const cruiseTime = 3.1;
        const decelerationTime = 4.2;
        const distance = reelStartPosition - reelTargetPosition;
        const maxVelocity = distance / (accelerationTime * 0.55 + cruiseTime + decelerationTime * 0.5);
        let travelled;

        if (elapsed < accelerationTime) {
            travelled = 0.5 * (maxVelocity / accelerationTime) * elapsed ** 2;
        } else if (elapsed < accelerationTime + cruiseTime) {
            travelled = maxVelocity * (accelerationTime * 0.55 + elapsed - accelerationTime);
        } else {
            const slowingTime = Math.min(elapsed - accelerationTime - cruiseTime, decelerationTime);
            travelled = maxVelocity * (accelerationTime * 0.55 + cruiseTime + slowingTime - (slowingTime ** 2 / (2 * decelerationTime)));
        }

        reelVelocity = elapsed < accelerationTime ? maxVelocity * elapsed / accelerationTime : maxVelocity;
        setReelPosition(reelStartPosition - travelled);

        if (elapsed < 9.8) {
            reelAnimationFrame = requestAnimationFrame(animateReel);
            return;
        }

        reelIsRunning = false;
        reelVelocity = 0;
        setReelPosition(reelTargetPosition);
        if (openingStatus) openingStatus.textContent = 'Открытие завершено';
        showResultModal(resultDrop);
    }

    function startReelOpening() {
        if (!openingOverlay || !reelWindow) return;
        hideResultModal();
        reelPrepared = false;
        prepareReel();
        const winner = reelTrack.querySelector('.reel-winner');
        reelTargetPosition = reelWindow.clientWidth / 2 - (winner.offsetLeft + winner.offsetWidth / 2);

        const trackWidth = reelTrack.scrollWidth || 0;
        const startOffset = Math.min(Math.max(trackWidth * 0.75, 2600), 4300);
        reelStartPosition = reelTargetPosition + startOffset;

        cancelAnimationFrame(reelAnimationFrame);
        if (openingProgress) {
            openingProgress.style.animation = 'none';
            void openingProgress.offsetWidth;
            openingProgress.style.animation = '';
        }
        if (openingStatus) openingStatus.textContent = 'Открывается...';
        setReelPosition(reelStartPosition);
        reelStartTime = performance.now();
        reelIsRunning = true;
        reelAnimationFrame = requestAnimationFrame(animateReel);
    }

    if (openCaseButton) {
        openCaseButton.addEventListener('click', function() {
            openingOverlay.classList.add('active');
            openingOverlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('case-opening-active');
            startReelOpening();
        });
    }

    if (openingClose) {
        openingClose.addEventListener('click', function() {
            openingOverlay.classList.remove('active');
            openingOverlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('case-opening-active');
            hideResultModal();
            cancelAnimationFrame(reelAnimationFrame);
            reelIsRunning = false;
        });
    }

    if (dropResultClose) {
        dropResultClose.addEventListener('click', function() {
            hideResultModal();
            openingOverlay.classList.remove('active');
            openingOverlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('case-opening-active');
            cancelAnimationFrame(reelAnimationFrame);
            reelIsRunning = false;
        });
    }

    if (reelWindow) {
        reelWindow.addEventListener('pointerdown', function(event) {
            if (reelIsRunning) return;
            reelDragging = true;
            reelPointerX = event.clientX;
            reelPointerTime = performance.now();
            reelVelocity = 0;
            cancelAnimationFrame(reelAnimationFrame);
            reelWindow.setPointerCapture(event.pointerId);
        });

        reelWindow.addEventListener('pointermove', function(event) {
            if (!reelDragging) return;
            const now = performance.now();
            const elapsed = Math.max(now - reelPointerTime, 1);
            const movement = event.clientX - reelPointerX;
            reelVelocity = movement / (elapsed / 1000);
            setReelPosition(reelPosition + movement);
            reelPointerX = event.clientX;
            reelPointerTime = now;
        });

        reelWindow.addEventListener('pointerup', function(event) {
            if (!reelDragging) return;
            reelDragging = false;
            reelWindow.releasePointerCapture(event.pointerId);
            reelLastTime = 0;
            requestAnimationFrame(animateReel);
        });
    }

    const pages = document.querySelectorAll('.page');
    const navItems = document.querySelectorAll('.nav-item');

    function showPage(pageName) {
        pages.forEach(page => {
            const isActive = page.dataset.page === pageName;
            page.classList.toggle('active', isActive);
        });

        navItems.forEach(item => {
            const label = item.querySelector('.nav-label')?.textContent?.trim();
            const isActive = pageNameMap[label] === pageName;
            item.classList.toggle('active', isActive);
        });
    }

    const donateNav = document.querySelector('.nav-item-add');
    if (donateNav) {
        donateNav.addEventListener('click', function(e) {
            e.preventDefault();
            showPage('donate');
        });
    }

    const pageNameMap = {
        'Главная': 'home',
        'Витрина': 'shop',
        'Топ': 'top',
        'Профиль': 'profile'
    };

    navItems.forEach(item => {
        if (item.classList.contains('nav-item-add')) return;

        item.addEventListener('click', function(e) {
            e.preventDefault();
            const label = this.querySelector('.nav-label')?.textContent?.trim();
            const pageName = pageNameMap[label] || 'home';

            navItems.forEach(nav => {
                if (!nav.classList.contains('nav-item-add')) {
                    nav.classList.remove('active');
                }
            });
            this.classList.add('active');

            showPage(pageName);
        });
    });

    showPage('home');
});
