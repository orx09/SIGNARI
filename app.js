// Variables globales
let camera;
let hands;
let videoElement;
let canvasElement;
let canvasCtx;
let currentFacingMode = 'user'; // 'user' = frontal, 'environment' = trasera
let detectedLetters = '';
let lastDetectedLetter = '';
let lastDetectionTime = 0;
let isProcessing = false;

// Ruta donde están las imágenes de las señas
const IMAGE_PATH = 'images/'; // Cambia esto si tu carpeta tiene otro nombre

// Inicializar cuando se carga la página
window.addEventListener('load', () => {
    init();
});

// Inicializar elementos y MediaPipe
function init() {
    videoElement = document.getElementById('video');
    canvasElement = document.getElementById('canvas');
    canvasCtx = canvasElement.getContext('2d');

    // Configurar MediaPipe Hands
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 1, // Solo una mano para mejor precisión
        modelComplexity: 1,
        minDetectionConfidence: 0.7, // Mayor confianza
        minTrackingConfidence: 0.7
    });

    hands.onResults(onResults);

    updateStatus('ready', '✅ Sistema listo. Presiona "Iniciar Cámara"');
}

// Callback cuando MediaPipe detecta manos
function onResults(results) {
    if (!canvasElement || !canvasCtx) return;

    // Limpiar canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (const landmarks of results.multiHandLandmarks) {
            // Dibujar las conexiones de la mano
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                color: '#00FF00',
                lineWidth: 5
            });
            // Dibujar los puntos de referencia
            drawLandmarks(canvasCtx, landmarks, {
                color: '#FF0000',
                lineWidth: 2
            });

            // Reconocer la letra
            const detectedLetter = recognizeSign(landmarks);
            if (detectedLetter) {
                addDetectedLetter(detectedLetter);
            }
        }
    }

    canvasCtx.restore();
}

// Calcular distancia entre dos puntos
function getDistance(point1, point2) {
    return Math.sqrt(
        Math.pow(point1.x - point2.x, 2) + 
        Math.pow(point1.y - point2.y, 2) +
        Math.pow(point1.z - point2.z, 2)
    );
}

// Verificar si un dedo está extendido
function isFingerExtended(tip, pip, mcp) {
    return tip.y < pip.y && pip.y < mcp.y;
}

// Verificar si el pulgar está extendido (movimiento horizontal)
function isThumbExtended(tip, ip, mcp) {
    return Math.abs(tip.x - mcp.x) > Math.abs(ip.x - mcp.x);
}

// Reconocer señas mejorado - TODO EL ALFABETO
function recognizeSign(landmarks) {
    // Puntos clave de los dedos
    const thumbTip = landmarks[4];
    const thumbIP = landmarks[3];
    const thumbMCP = landmarks[2];
    
    const indexTip = landmarks[8];
    const indexPIP = landmarks[6];
    const indexMCP = landmarks[5];
    
    const middleTip = landmarks[12];
    const middlePIP = landmarks[10];
    const middleMCP = landmarks[9];
    
    const ringTip = landmarks[16];
    const ringPIP = landmarks[14];
    const ringMCP = landmarks[13];
    
    const pinkyTip = landmarks[20];
    const pinkyPIP = landmarks[18];
    const pinkyMCP = landmarks[17];
    
    const wrist = landmarks[0];
    const palmBase = landmarks[0];

    // Calcular si los dedos están extendidos
    const thumbExt = isThumbExtended(thumbTip, thumbIP, thumbMCP);
    const indexExt = isFingerExtended(indexTip, indexPIP, indexMCP);
    const middleExt = isFingerExtended(middleTip, middlePIP, middleMCP);
    const ringExt = isFingerExtended(ringTip, ringPIP, ringMCP);
    const pinkyExt = isFingerExtended(pinkyTip, pinkyPIP, pinkyMCP);

    // Contar dedos extendidos
    const fingersExtended = [indexExt, middleExt, ringExt, pinkyExt].filter(x => x).length;

    // Distancias útiles
    const thumbIndexDist = getDistance(thumbTip, indexTip);
    const thumbMiddleDist = getDistance(thumbTip, middleTip);
    const indexMiddleDist = getDistance(indexTip, middleTip);
    const thumbPalmDist = getDistance(thumbTip, palmBase);

    // ========== RECONOCIMIENTO DE LETRAS ==========

    // A - Puño cerrado con pulgar al lado
    if (!indexExt && !middleExt && !ringExt && !pinkyExt && thumbExt) {
        return 'A';
    }

    // B - Mano abierta, dedos juntos, pulgar doblado
    if (indexExt && middleExt && ringExt && pinkyExt && !thumbExt) {
        if (indexMiddleDist < 0.08) {
            return 'B';
        }
    }

    // C - Mano en forma de C
    if (thumbExt && indexExt && !middleExt && !ringExt && !pinkyExt) {
        if (thumbIndexDist > 0.1 && thumbIndexDist < 0.25) {
            return 'C';
        }
    }

    // D - Índice arriba, otros dedos tocando pulgar
    if (indexExt && !middleExt && !ringExt && !pinkyExt && thumbExt) {
        if (thumbMiddleDist < 0.08) {
            return 'D';
        }
    }

    // E - Todos los dedos doblados incluyendo pulgar
    if (!indexExt && !middleExt && !ringExt && !pinkyExt && !thumbExt) {
        return 'E';
    }

    // F - OK con índice y pulgar, otros extendidos
    if (thumbExt && !indexExt && middleExt && ringExt && pinkyExt) {
        if (thumbIndexDist < 0.08) {
            return 'F';
        }
    }

    // G - Índice y pulgar horizontal
    if (indexExt && thumbExt && !middleExt && !ringExt && !pinkyExt) {
        const horizontal = Math.abs(indexTip.y - thumbTip.y) < 0.1;
        if (horizontal && thumbIndexDist > 0.15) {
            return 'G';
        }
    }

    // H - Índice y medio horizontales
    if (indexExt && middleExt && !ringExt && !pinkyExt) {
        const horizontal = Math.abs(indexTip.y - middleTip.y) < 0.05;
        if (horizontal && thumbIndexDist < 0.1) {
            return 'H';
        }
    }

    // I - Solo meñique extendido
    if (!indexExt && !middleExt && !ringExt && pinkyExt && !thumbExt) {
        return 'I';
    }

    // J - Meñique extendido con movimiento (simplificado como I con pulgar)
    if (!indexExt && !middleExt && !ringExt && pinkyExt && thumbExt) {
        return 'J';
    }

    // K - Índice arriba, medio en ángulo, pulgar toca medio
    if (indexExt && middleExt && !ringExt && !pinkyExt && thumbExt) {
        if (thumbMiddleDist < 0.08 && indexTip.y < middleTip.y) {
            return 'K';
        }
    }

    // L - L con índice y pulgar
    if (indexExt && thumbExt && !middleExt && !ringExt && !pinkyExt) {
        const angle = Math.abs(indexTip.x - thumbTip.x) > 0.1 && 
                      Math.abs(indexTip.y - thumbTip.y) > 0.1;
        if (angle && thumbIndexDist > 0.12) {
            return 'L';
        }
    }

    // M - Tres dedos doblados sobre pulgar
    if (!indexExt && !middleExt && !ringExt && !pinkyExt && thumbExt) {
        if (thumbPalmDist < 0.15) {
            return 'M';
        }
    }

    // N - Dos dedos sobre pulgar
    if (!indexExt && !middleExt && ringExt && pinkyExt && thumbExt) {
        return 'N';
    }

    // O - Todos los dedos formando círculo
    if (thumbIndexDist < 0.06 && fingersExtended >= 3) {
        return 'O';
    }

    // P - Como K pero apuntando hacia abajo
    if (indexExt && middleExt && !ringExt && !pinkyExt) {
        if (indexTip.y > wrist.y && middleTip.y > wrist.y) {
            return 'P';
        }
    }

    // Q - Como G pero apuntando hacia abajo
    if (indexExt && thumbExt && !middleExt && !ringExt && !pinkyExt) {
        if (indexTip.y > palmBase.y) {
            return 'Q';
        }
    }

    // R - Índice y medio cruzados
    if (indexExt && middleExt && !ringExt && !pinkyExt) {
        if (indexMiddleDist < 0.05 && thumbIndexDist > 0.1) {
            return 'R';
        }
    }

    // S - Puño cerrado con pulgar sobre dedos
    if (!indexExt && !middleExt && !ringExt && !pinkyExt && !thumbExt) {
        if (thumbTip.y < indexMCP.y) {
            return 'S';
        }
    }

    // T - Pulgar entre índice y medio
    if (!indexExt && !middleExt && ringExt && pinkyExt && thumbExt) {
        if (thumbTip.y < middleMCP.y && thumbTip.y > middlePIP.y) {
            return 'T';
        }
    }

    // U - Índice y medio juntos hacia arriba
    if (indexExt && middleExt && !ringExt && !pinkyExt) {
        if (indexMiddleDist < 0.05 && !thumbExt) {
            return 'U';
        }
    }

    // V - Índice y medio separados en V
    if (indexExt && middleExt && !ringExt && !pinkyExt) {
        if (indexMiddleDist > 0.08 && indexMiddleDist < 0.15) {
            return 'V';
        }
    }

    // W - Tres dedos arriba (índice, medio, anular)
    if (indexExt && middleExt && ringExt && !pinkyExt) {
        return 'W';
    }

    // X - Índice doblado en forma de gancho
    if (!indexExt && !middleExt && !ringExt && !pinkyExt) {
        const indexBent = indexPIP.y < indexMCP.y && indexTip.y > indexPIP.y;
        if (indexBent) {
            return 'X';
        }
    }

    // Y - Pulgar y meñique extendidos (hang loose)
    if (thumbExt && !indexExt && !middleExt && !ringExt && pinkyExt) {
        return 'Y';
    }

    // Z - Índice hace zigzag (simplificado: índice apuntando)
    if (indexExt && !middleExt && !ringExt && !pinkyExt && !thumbExt) {
        if (indexTip.y < indexMCP.y) {
            return 'Z';
        }
    }

    return null;
}

// Agregar letra detectada al texto
function addDetectedLetter(letter) {
    const currentTime = Date.now();
    
    // Evitar detecciones duplicadas muy rápidas (1.5 segundos)
    if (letter === lastDetectedLetter && currentTime - lastDetectionTime < 1500) {
        return;
    }

    lastDetectedLetter = letter;
    lastDetectionTime = currentTime;
    
    detectedLetters += letter;
    
    // Actualizar UI
    const textElement = document.getElementById('detectedText');
    textElement.textContent = detectedLetters || 'Las señas aparecerán aquí...';
    
    // Feedback visual
    textElement.style.transform = 'scale(1.1)';
    setTimeout(() => {
        textElement.style.transform = 'scale(1)';
    }, 200);
}

// Iniciar la cámara
async function startCamera() {
    try {
        updateStatus('loading', '🔄 Iniciando cámara...');

        const constraints = {
            video: {
                facingMode: currentFacingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;

        // Esperar a que el video esté listo
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                resolve();
            };
        });

        await videoElement.play();

        // Ajustar el tamaño del canvas
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        // Iniciar MediaPipe Camera
        camera = new Camera(videoElement, {
            onFrame: async () => {
                if (hands && videoElement.readyState === 4) {
                    await hands.send({ image: videoElement });
                }
            },
            width: 1280,
            height: 720
        });

        await camera.start();

        // Actualizar botones
        document.getElementById('startBtn').disabled = true;
        document.getElementById('switchBtn').disabled = false;
        document.getElementById('stopBtn').disabled = false;

        updateStatus('ready', '✅ Cámara activa. Muestra tus señas claramente.');

    } catch (error) {
        console.error('Error al iniciar cámara:', error);
        updateStatus('error', '❌ Error: No se pudo acceder a la cámara');
    }
}

// Detener la cámara
function stopCamera() {
    if (camera) {
        camera.stop();
        camera = null;
    }

    if (videoElement && videoElement.srcObject) {
        const tracks = videoElement.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoElement.srcObject = null;
    }

    // Limpiar canvas
    if (canvasCtx && canvasElement) {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }

    // Actualizar botones
    document.getElementById('startBtn').disabled = false;
    document.getElementById('switchBtn').disabled = true;
    document.getElementById('stopBtn').disabled = true;

    updateStatus('ready', '✅ Cámara detenida');
}

// Cambiar entre cámara frontal y trasera
async function switchCamera() {
    // Detener cámara actual completamente
    stopCamera();
    
    // Esperar un momento para que se liberen los recursos
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Cambiar el modo
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    
    // Reiniciar cámara con el nuevo modo
    await startCamera();
}

// Actualizar el estado visual
function updateStatus(type, message) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.className = `status ${type}`;
        statusElement.textContent = message;
    }
}

// Cambiar entre modos (cámara/texto)
function switchMode(mode) {
    // Actualizar tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Usar event.target si está disponible, sino buscar por el modo
    if (window.event && event.target) {
        event.target.classList.add('active');
    } else {
        // Alternativa: agregar active al tab correcto
        const tabs = document.querySelectorAll('.tab');
        if (mode === 'camera') {
            tabs[0].classList.add('active');
        } else {
            tabs[1].classList.add('active');
        }
    }

    // Actualizar contenido
    document.querySelectorAll('.mode').forEach(m => {
        m.classList.remove('active');
    });

    if (mode === 'camera') {
        document.getElementById('camera-mode').classList.add('active');
    } else {
        document.getElementById('text-mode').classList.add('active');
        // Detener cámara si está activa
        if (camera) {
            stopCamera();
        }
    }
}

// Convertir texto a señas - CON IMÁGENES REALES
function textToSigns() {
    const input = document.getElementById('textInput').value.toUpperCase();
    const signDisplay = document.getElementById('signDisplay');
    
    if (input.length === 0) {
        signDisplay.innerHTML = '<p style="color: #999; text-align: center; width: 100%;">Escribe algo en el campo de arriba...</p>';
        return;
    }

    signDisplay.innerHTML = '';

    for (let char of input) {
        if (char.match(/[A-Z]/)) {
            const card = document.createElement('div');
            card.className = 'sign-card';
            
            const letter = document.createElement('div');
            letter.className = 'letter';
            letter.textContent = char;
            
            // CREAR IMAGEN EN VEZ DE EMOJI
            const img = document.createElement('img');
            img.className = 'sign-image';
            img.src = `${IMAGE_PATH}${char.toLowerCase()}.jpg`;
            img.alt = `Seña ${char}`;
            
            // Si la imagen no carga, mostrar un placeholder
            img.onerror = function() {
                this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23ddd"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999" font-size="40"%3E' + char + '%3C/text%3E%3C/svg%3E';
            };
            
            card.appendChild(letter);
            card.appendChild(img);
            signDisplay.appendChild(card);
            
        } else if (char === ' ') {
            const card = document.createElement('div');
            card.className = 'sign-card';
            
            const letter = document.createElement('div');
            letter.className = 'letter';
            letter.textContent = 'ESPACIO';
            letter.style.fontSize = '1em';
            
            const spacer = document.createElement('div');
            spacer.className = 'space-indicator';
            spacer.textContent = '[ ]';
            spacer.style.fontSize = '3em';
            spacer.style.color = '#999';
            
            card.appendChild(letter);
            card.appendChild(spacer);
            signDisplay.appendChild(card);
        }
    }
}

// Agregar botón para borrar texto
function clearDetectedText() {
    detectedLetters = '';
    lastDetectedLetter = '';
    document.getElementById('detectedText').textContent = 'Las señas aparecerán aquí...';
}