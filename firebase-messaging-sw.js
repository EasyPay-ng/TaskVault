importScripts('https://www.gstatic.com/firebasejs/10.5.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.5.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyAv6QCpopa0Q77AVTyjU5cqJEIKIE9OVTs",
    authDomain: "taskvault-412a0.firebaseapp.com",
    projectId: "taskvault-412a0",
    storageBucket: "taskvault-412a0.firebasestorage.app",
    messagingSenderId: "420716701831",
    appId: "1:420716701831:web:c987d91f7f4c8684eb7022"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    const notificationTitle = payload.notification?.title || 'CashClique';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new notification',
        icon: 'https://res.cloudinary.com/dq7fpxfbc/image/upload/v1775059285/logo_oo5yat.jpg',
        badge: 'https://res.cloudinary.com/dq7fpxfbc/image/upload/v1775059285/logo_oo5yat.jpg',
        tag: payload.data?.tag || 'default',
        requireInteraction: true,
        data: payload.data || {}
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const urlToOpen = event.notification.data?.url || '/index.html';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If app is already open, focus it
            for (const client of clientList) {
                if (client.url.includes('index.html') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
