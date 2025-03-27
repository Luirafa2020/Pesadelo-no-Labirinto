// --- START OF FILE textures.js ---

import * as THREE from 'three'; // <<< ADICIONAR ESTA LINHA

// Cache para texturas geradas, para não recriar a cada vez
const textureCache = {};

/**
 * Cria uma textura Three.js a partir de um SVG.
 * @param {string} svgString - A string SVG completa.
 * @param {number} width - Largura desejada da textura em pixels.
 * @param {number} height - Altura desejada da textura em pixels.
 * @param {string} cacheKey - Chave única para cache.
 * @param {boolean} repeat - Se a textura deve repetir.
 * @param {number} repeatX - Repetição no eixo X.
 * @param {number} repeatY - Repetição no eixo Y.
 * @param {THREE.WebGLRenderer} threeRendererInstance - Instância do renderer para obter capacidades.
 * @returns {Promise<THREE.CanvasTexture>} - Promessa que resolve com a textura.
 */
function createTextureFromSVG(svgString, width, height, cacheKey, repeat = true, repeatX = 1, repeatY = 1, threeRendererInstance) {
    if (textureCache[cacheKey]) {
        return Promise.resolve(textureCache[cacheKey]);
    }

    if (!threeRendererInstance || !threeRendererInstance.capabilities) {
        console.warn("Instância do Renderer inválida ou não fornecida para createTextureFromSVG para a chave:", cacheKey);
    }


    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);

            // Agora THREE está definido por causa do import no topo
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;

            if (repeat) {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(repeatX, repeatY);
            } else {
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
            }

            if (threeRendererInstance && threeRendererInstance.capabilities) {
               texture.anisotropy = threeRendererInstance.capabilities.getMaxAnisotropy();
            } else {
               texture.anisotropy = 1;
            }
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;

            textureCache[cacheKey] = texture;
            resolve(texture);
        };

        img.onerror = (err) => {
            console.error("Erro ao carregar SVG para textura:", err);
            URL.revokeObjectURL(url);
            reject(err);
        };

        img.src = url;
    });
}

// --- Definições de Texturas SVG ---

// Textura de Parede (Tijolos Escuros e Sujos)
const wallSvg = `
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="noise" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.15
                                           0 0 0 0 0.1
                                           0 0 0 0 0.1
                                           0 0 0 0.5 0" />
      <feComposite operator="in" in2="SourceGraphic"/>
    </filter>
     <pattern id="brickPattern" patternUnits="userSpaceOnUse" width="64" height="32">
        <rect width="64" height="32" fill="#281810"/>
        <!-- Linhas Horizontais -->
        <line x1="0" y1="0.5" x2="64" y2="0.5" stroke="#1a100a" stroke-width="1"/>
        <line x1="0" y1="16.5" x2="64" y2="16.5" stroke="#1a100a" stroke-width="1"/>
        <!-- Linhas Verticais (Alternadas) -->
        <line x1="31.5" y1="0" x2="31.5" y2="16" stroke="#1a100a" stroke-width="1"/>
        <line x1="0.5" y1="16" x2="0.5" y2="32" stroke="#1a100a" stroke-width="1"/>
        <line x1="63.5" y1="16" x2="63.5" y2="32" stroke="#1a100a" stroke-width="1"/> <!-- Correção para borda -->
     </pattern>
  </defs>
  <rect width="128" height="128" fill="url(#brickPattern)" />
  <rect width="128" height="128" fill="rgba(10,5,5,0.4)" /> <!-- Overlay escuro -->
  <rect width="128" height="128" filter="url(#noise)" /> <!-- Aplica ruído -->
</svg>
`;

// Textura do Chão (Concreto Rachado ou Pedra Suja)
const floorSvg = `
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="floorNoise" x="0" y="0" width="100%" height="100%">
       <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="5" seed="10" stitchTiles="stitch"/>
       <feColorMatrix type="matrix" values="1 0 0 0 0
                                            0 1 0 0 0
                                            0 0 1 0 0
                                            0 0 0 18 -7" result="noise"/>
       <feComposite operator="in" in2="SourceGraphic" result="noiseApplied"/>

        <feTurbulence type="turbulence" baseFrequency="0.03" numOctaves="2" seed="20" result="cracksTurbulence"/>
        <feColorMatrix type="matrix" values="1 0 0 0 0
                                             0 1 0 0 0
                                             0 0 1 0 0
                                             0 0 0 5 -1.5" result="cracksMap"/>
       <feComposite in="SourceGraphic" in2="cracksMap" operator="out" result="cracks"/>

    </filter>
     <linearGradient id="floorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3a3a3a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2a2a2a;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" fill="url(#floorGradient)" />
  <rect width="128" height="128" fill="#333" filter="url(#floorNoise)" />
  <rect width="128" height="128" fill="black" opacity="0.6" filter="url(#cracks)"/> <!-- Rachaduras escuras -->
  <rect width="128" height="128" fill="rgba(5,5,10,0.3)" /> <!-- Tonalidade azulada/escura -->
</svg>
`;

// Textura do Teto (Similar ao Chão, mas mais escura talvez)
const ceilingSvg = `
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <defs>
     <filter id="ceilNoise" x="0" y="0" width="100%" height="100%">
       <feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="4" seed="30" stitchTiles="stitch"/>
       <feColorMatrix type="matrix" values="0 0 0 0 0.1
                                           0 0 0 0 0.1
                                           0 0 0 0 0.12
                                           0 0 0 0.6 0" />
        <feComposite operator="in" in2="SourceGraphic"/>
    </filter>
     <linearGradient id="ceilGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#252525;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#181818;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" fill="url(#ceilGradient)" />
  <rect width="128" height="128" filter="url(#ceilNoise)" />
  <rect width="128" height="128" fill="rgba(0,0,0,0.5)" /> <!-- Mais escuro -->
</svg>
`;

// Textura da Saída (Algo que se destaque um pouco)
const exitSvg = `
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#103010" /> <!-- Verde escuro -->
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
   <text x="64" y="78" font-family="Arial, sans-serif" font-size="30" fill="#00ff00" text-anchor="middle" filter="url(#glow)">SAÍDA</text>
   <rect x="10" y="10" width="108" height="108" fill="none" stroke="#00cc00" stroke-width="4" />
   <line x1="0" y1="0" x2="128" y2="128" stroke="#090" stroke-width="1" />
   <line x1="128" y1="0" x2="0" y2="128" stroke="#090" stroke-width="1" />
</svg>
`;


// --- Função para Carregar Todas as Texturas ---
// Note que a variável 'textures' aqui é local para este módulo agora.
// Poderíamos exportá-la também se fosse necessária em outros módulos, mas
// loadTextures retorna o objeto, o que é suficiente para main.js.
let textures = {};

async function loadTextures(threeRenderer) {
    console.log("Carregando texturas SVG...");
    try {
        const [wall, floor, ceiling, exit] = await Promise.all([
            createTextureFromSVG(wallSvg, 256, 256, 'wall', true, 4, 4, threeRenderer),
            createTextureFromSVG(floorSvg, 512, 512, 'floor', true, 8, 8, threeRenderer),
            createTextureFromSVG(ceilingSvg, 512, 512, 'ceiling', true, 8, 8, threeRenderer),
            createTextureFromSVG(exitSvg, 128, 128, 'exit', false, 1, 1, threeRenderer)
        ]);
        textures = { wall, floor, ceiling, exit };
        console.log("Texturas SVG carregadas com sucesso!");
        return textures;
    } catch (error) {
        console.error("Falha ao carregar uma ou mais texturas SVG:", error);
        throw error; // Re-lança o erro para main.js saber
    }
}

// --- Exporta a função para ser usada por main.js ---
export { loadTextures };

// --- FIM DO ARQUIVO textures.js ---