// maze.js

/**
 * Gera um labirinto simples usando o algoritmo Recursive Backtracker.
 * @param {number} width - Largura do labirinto (número de células).
 * @param {number} height - Altura do labirinto (número de células).
 * @returns {Array<Array<object>>} - Grid 2D representando o labirinto.
 * Cada célula é um objeto com: { x, y, top: bool, right: bool, bottom: bool, left: bool, visited: bool }
 */
function generateMaze(width, height) {
    console.log(`Gerando labirinto ${width}x${height}...`);
    const maze = [];
    const stack = [];

    // 1. Inicializa o grid com todas as paredes e não visitado
    for (let y = 0; y < height; y++) {
        maze[y] = [];
        for (let x = 0; x < width; x++) {
            maze[y][x] = {
                x, y,
                top: true, right: true, bottom: true, left: true, // Paredes
                visited: false,
                isExit: false // Marca se é a célula de saída
            };
        }
    }

    // 2. Escolhe uma célula inicial aleatória
    let currentX = Math.floor(Math.random() * width);
    let currentY = Math.floor(Math.random() * height);
    let currentCell = maze[currentY][currentX];
    currentCell.visited = true;
    let visitedCount = 1;

    // 3. Loop principal do algoritmo
    while (visitedCount < width * height) {
        // Encontra vizinhos não visitados
        const neighbors = [];
        // Top
        if (currentY > 0 && !maze[currentY - 1][currentX].visited) {
            neighbors.push(maze[currentY - 1][currentX]);
        }
        // Right
        if (currentX < width - 1 && !maze[currentY][currentX + 1].visited) {
            neighbors.push(maze[currentY][currentX + 1]);
        }
        // Bottom
        if (currentY < height - 1 && !maze[currentY + 1][currentX].visited) {
            neighbors.push(maze[currentY + 1][currentX]);
        }
        // Left
        if (currentX > 0 && !maze[currentY][currentX - 1].visited) {
            neighbors.push(maze[currentY][currentX - 1]);
        }

        if (neighbors.length > 0) {
            // Escolhe um vizinho aleatório
            const nextCell = neighbors[Math.floor(Math.random() * neighbors.length)];

            // Empilha a célula atual
            stack.push(currentCell);

            // Remove a parede entre a célula atual e a próxima
            if (nextCell.y < currentCell.y) { // Vizinho é o de cima
                currentCell.top = false;
                nextCell.bottom = false;
            } else if (nextCell.x > currentCell.x) { // Vizinho é o da direita
                currentCell.right = false;
                nextCell.left = false;
            } else if (nextCell.y > currentCell.y) { // Vizinho é o de baixo
                currentCell.bottom = false;
                nextCell.top = false;
            } else if (nextCell.x < currentCell.x) { // Vizinho é o da esquerda
                currentCell.left = false;
                nextCell.right = false;
            }

            // Move para a próxima célula
            currentCell = nextCell;
            currentCell.visited = true;
            visitedCount++;
            currentX = currentCell.x;
            currentY = currentCell.y;

        } else if (stack.length > 0) {
            // Se não há vizinhos não visitados, retorna pela pilha (backtrack)
            currentCell = stack.pop();
            currentX = currentCell.x;
            currentY = currentCell.y;
        } else {
            // Deveria ter terminado, mas caso algo dê errado
            console.warn("Backtracking stack vazio antes de visitar tudo?");
            break; // Sai do loop para evitar loop infinito
        }
    }

    // Define uma saída aleatória em uma das bordas (mas não no canto inicial)
    let exitX, exitY;
    do {
        const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
        if (edge === 0) { exitX = Math.floor(Math.random() * width); exitY = 0; maze[exitY][exitX].top = false; }
        else if (edge === 1) { exitX = width - 1; exitY = Math.floor(Math.random() * height); maze[exitY][exitX].right = false; }
        else if (edge === 2) { exitX = Math.floor(Math.random() * width); exitY = height - 1; maze[exitY][exitX].bottom = false; }
        else { exitX = 0; exitY = Math.floor(Math.random() * height); maze[exitY][exitX].left = false; }
    } while (exitX === 0 && exitY === 0); // Evita a saída no canto (0,0) como exemplo

    maze[exitY][exitX].isExit = true;
    console.log(`Labirinto gerado. Saída em (${exitX}, ${exitY})`);

    return maze;
}

window.MazeGenerator = { generateMaze };