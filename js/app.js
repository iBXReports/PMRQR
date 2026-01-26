
// Main App Logic

document.addEventListener('DOMContentLoaded', async () => {

    // UI Elements
    const authSection = document.getElementById('authSection');
    const appSection = document.getElementById('appSection');
    const loginForm = document.getElementById('loginForm');

    // Check Session
    const checkSession = async () => {
        // Wait for DB to be ready loop
        let attempts = 0;
        while (!window.DB.ready && attempts < 10) {
            await new Promise(r => setTimeout(r, 200));
            attempts++;
        }

        const session = await window.DB.checkAuth();
        if (session.isLoggedIn) {
            authSection.classList.add('hidden');
            appSection.classList.remove('hidden');
            document.getElementById('userDisplay').innerText = session.username;

            // Redirect admin if needed, or allow them to use scanner too
            if (session.role === 'admin') {
                // Maybe add a link to admin?
            }

            // Checks for ?code=URL_PARAM logic
            const urlParams = new URLSearchParams(window.location.search);
            const codeParam = urlParams.get('code');
            if (codeParam) {
                console.log("Code detected in URL:", codeParam);
                // Simulate scan success
                onScanSuccess(codeParam);
            }
        } else {
            authSection.classList.remove('hidden');
            appSection.classList.add('hidden');
        }
    };

    checkSession();

    // ... (Login Handler) ...

    // ... (Scanner Logic) ...

    function onScanSuccess(decodedText, decodedResult) {
        // Stop scanning if camera running
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(() => resetScanUI()).catch(e => console.log(e));
        }

        // Handle URL or Plain Text
        let finalCode = decodedText;
        try {
            // Check if it's a URL with a 'code' param
            if (decodedText.startsWith('http')) {
                const url = new URL(decodedText);
                const code = url.searchParams.get('code');
                if (code) finalCode = code;
            }
        } catch (e) {
            // Not a URL, use as is
        }

        console.log("Detected Asset:", finalCode);

        // Show Form
        scanActions.classList.add('hidden');
        movementForm.classList.remove('hidden');
        document.getElementById('detectedCode').innerText = finalCode;

        // Auto-fill origin if user has a default? (Future feature)
    }

    window.resetApp = () => {
        location.reload();
    };

    function resetScanUI() {
        readerElem.classList.add('hidden');
        document.getElementById('stopScan').classList.add('hidden');
        document.getElementById('btnScanCamera').classList.remove('hidden');
        document.getElementById('btnScanFile').classList.remove('hidden');
    }

    // Submit Movement
    movementForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = movementForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerText = "Guardando...";

        const data = {
            chair_code: document.getElementById('detectedCode').innerText,
            origin: document.getElementById('origin').value,
            destination: document.getElementById('destination').value,
            final_location: document.getElementById('finalLocation').value
        };

        const result = await window.DB.logMovement(data);
        if (result.success) {
            alert("Movimiento registrado correctamente");
            resetApp();
        } else {
            alert("Error: " + result.message);
            btn.disabled = false;
            btn.innerText = "Confirmar Movimiento";
        }
    });

});
