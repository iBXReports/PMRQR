
// assets/js/qr_handler.js

let videoStream = null;
let currentScanTarget = 'asset'; // 'asset' or 'return'

/**
 * Handle QR extraction from an uploaded image
 */
window.handleQrUpload = function (event, target = 'asset') {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            context.drawImage(img, 0, 0);

            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code) {
                console.log(`QR Found via Gallery (${target}):`, code.data);
                const eventName = target === 'return' ? 'qr-return-scanned' : 'qr-scanned';
                window.dispatchEvent(new CustomEvent(eventName, {
                    detail: {
                        code: code.data,
                        target: target
                    }
                }));
            } else {
                alert("No se encontró ningún código QR válido en la imagen.");
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

/**
 * Camera Scanning logic using jsQR
 */
window.startCameraScan = async function (target = 'asset') {
    currentScanTarget = target;
    const container = document.getElementById('camera-preview-container');
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const context = canvas.getContext('2d');

    // If starting from return, the container is in a different view, but we'll use the same fixed one for simplicity or move it
    // For now, let's ensure the container is visible in the current view or centered
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.zIndex = '9999';
    container.style.background = 'var(--card-bg)';
    container.style.padding = '1rem';
    container.style.borderRadius = '15px';
    container.style.boxShadow = '0 0 50px rgba(0,0,0,0.5)';

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = videoStream;
        video.setAttribute("playsinline", true);
        video.play();

        container.style.display = 'block';

        const tick = () => {
            if (!videoStream) return; // Stop if stream closed

            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                // Optimization: Limit canvas size for scanning. 
                // Full resolution is too heavy for JS QR on mobile.
                const MAX_WIDTH = 500;
                let scale = 1;

                if (video.videoWidth > MAX_WIDTH) {
                    scale = MAX_WIDTH / video.videoWidth;
                }

                // Set canvas to scaled size (or full size if small)
                // Actually, for display we might want full res, but for scanning we typically want speed.
                // Let's keep display canvas full res if we want a nice preview, but draw to a smaller offscreen canvas?
                // Or just resize the main canvas. Resizing main canvas is efficient.
                canvas.width = video.videoWidth * scale;
                canvas.height = video.videoHeight * scale;

                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Optimization: Throttle Scanning (e.g. every 200ms) to save battery/CPU
                // We use a global or attached property to track last scan
                const now = Date.now();
                if (!window.lastScanTime || (now - window.lastScanTime > 200)) {
                    window.lastScanTime = now;

                    try {
                        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                        const code = jsQR(imageData.data, imageData.width, imageData.height);

                        if (code) {
                            const eventName = currentScanTarget === 'return' ? 'qr-return-scanned' : 'qr-scanned';
                            window.dispatchEvent(new CustomEvent(eventName, {
                                detail: {
                                    code: code.data,
                                    target: currentScanTarget
                                }
                            }));
                            stopCameraScan();
                            return;
                        }
                    } catch (e) {
                        console.warn('QR processing error', e);
                    }
                }
            }
            if (videoStream) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);

    } catch (err) {
        console.error("Camera Error:", err);
        alert("No se pudo acceder a la cámara. Asegúrate de dar permisos.");
    }
};

window.stopCameraScan = function () {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    const container = document.getElementById('camera-preview-container');
    if (container) container.style.display = 'none';
};
