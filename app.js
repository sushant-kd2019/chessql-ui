const { ipcRenderer } = require('electron');
const { Chess } = require('chess.js');

class ChessQLApp {
    constructor() {
        this.currentGames = [];
        this.currentGame = null;
        this.currentMoveIndex = 0;
        this.chess = new Chess();
        this.gameMoves = []; // Store the moves separately
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.queryInput = document.getElementById('queryInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.errorMessage = document.getElementById('errorMessage');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.gameModal = document.getElementById('gameModal');
        this.closeModal = document.getElementById('closeModal');
        this.chessBoard = document.getElementById('chessBoard');
        this.movesList = document.getElementById('movesList');
        
        // Game info elements
        this.gameTitle = document.getElementById('gameTitle');
        this.whitePlayerName = document.getElementById('whitePlayerName');
        this.blackPlayerName = document.getElementById('blackPlayerName');
        this.whitePlayerElo = document.getElementById('whitePlayerElo');
        this.blackPlayerElo = document.getElementById('blackPlayerElo');
        this.gameResult = document.getElementById('gameResult');
        this.gameDate = document.getElementById('gameDate');
        this.gameSite = document.getElementById('gameSite');
        this.gameOpening = document.getElementById('gameOpening');
        
        // Move controls
        this.prevMoveBtn = document.getElementById('prevMove');
        this.nextMoveBtn = document.getElementById('nextMove');
        this.firstMoveBtn = document.getElementById('firstMove');
        this.lastMoveBtn = document.getElementById('lastMove');
    }

    bindEvents() {
        this.searchBtn.addEventListener('click', () => this.performSearch());
        this.clearBtn.addEventListener('click', () => this.clearSearch());
        this.queryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });
        
        // Example query clicks
        document.querySelectorAll('.example-query').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.queryInput.value = e.target.dataset.query;
                this.performSearch();
            });
        });
        
        // Modal events
        this.closeModal.addEventListener('click', () => this.closeGameModal());
        this.gameModal.addEventListener('click', (e) => {
            if (e.target === this.gameModal) {
                this.closeGameModal();
            }
        });
        
        // Move controls
        this.prevMoveBtn.addEventListener('click', () => this.previousMove());
        this.nextMoveBtn.addEventListener('click', () => this.nextMove());
        this.firstMoveBtn.addEventListener('click', () => this.goToFirstMove());
        this.lastMoveBtn.addEventListener('click', () => this.goToLastMove());
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    async performSearch() {
        const query = this.queryInput.value.trim();
        if (!query) return;

        const searchType = document.querySelector('input[name="searchType"]:checked').value;
        
        this.showLoading(true);
        this.hideError();

        try {
            const endpoint = searchType === 'natural' ? '/ask' : '/cql';
            const data = searchType === 'natural' 
                ? { question: query, limit: 50 }
                : { query: query, limit: 50 };

            const response = await ipcRenderer.invoke('api-request', {
                endpoint: endpoint,
                method: 'POST',
                data: data
            });

            if (response.success) {
                this.currentGames = response.data.results || [];
                this.displayGames();
            } else {
                this.showError(response.error || 'Search failed');
            }
        } catch (error) {
            this.showError('Failed to connect to ChessQL server. Make sure it\'s running.');
        } finally {
            this.showLoading(false);
        }
    }

    clearSearch() {
        this.queryInput.value = '';
        this.currentGames = [];
        this.resultsContainer.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome to ChessQL Desktop</h2>
                <p>Search for chess games using natural language or ChessQL queries.</p>
                <div class="example-queries">
                    <h3>Try these examples:</h3>
                    <div class="example-query" data-query="lecorvus won">lecorvus won</div>
                    <div class="example-query" data-query="queen sacrificed">queen sacrificed</div>
                    <div class="example-query" data-query="pawn promoted to queen">pawn promoted to queen</div>
                    <div class="example-query" data-query="SELECT * FROM games WHERE white_player = 'lecorvus'">SQL: lecorvus as white</div>
                </div>
            </div>
        `;
        
        // Re-bind example query events
        document.querySelectorAll('.example-query').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.queryInput.value = e.target.dataset.query;
                this.performSearch();
            });
        });
    }

    displayGames() {
        if (this.currentGames.length === 0) {
            this.resultsContainer.innerHTML = '<div class="welcome-message"><h2>No games found</h2><p>Try a different search query.</p></div>';
            return;
        }

        const gamesGrid = document.createElement('div');
        gamesGrid.className = 'games-grid';

        this.currentGames.forEach((game, index) => {
            const gameCard = this.createGameCard(game, index);
            gamesGrid.appendChild(gameCard);
        });

        this.resultsContainer.innerHTML = '';
        this.resultsContainer.appendChild(gamesGrid);
    }

    createGameCard(game, index) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.addEventListener('click', () => this.openGameModal(game));

        const thumbnail = document.createElement('div');
        thumbnail.className = 'game-thumbnail';
        
        // Create mini chess board
        const miniBoard = this.createMiniChessBoard(game);
        thumbnail.appendChild(miniBoard);

        const info = document.createElement('div');
        info.className = 'game-info';
        
        const players = document.createElement('div');
        players.className = 'game-players';
        players.textContent = `${game.white_player || 'White'} vs ${game.black_player || 'Black'}`;
        
        const result = document.createElement('div');
        result.className = 'game-result';
        result.textContent = `Result: ${game.result || 'Unknown'}`;
        
        const date = document.createElement('div');
        date.className = 'game-date';
        date.textContent = game.date_played || 'Unknown date';

        info.appendChild(players);
        info.appendChild(result);
        info.appendChild(date);

        card.appendChild(thumbnail);
        card.appendChild(info);

        return card;
    }

    createMiniChessBoard(game) {
        const board = document.createElement('div');
        board.className = 'chess-board-mini';
        
        // Parse the final position from moves
        const finalPosition = this.getFinalPosition(game.moves);
        
        // Create 8x8 grid
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                
                const piece = finalPosition[row][col];
                if (piece) {
                    const pieceElement = document.createElement('span');
                    pieceElement.textContent = this.getPieceSymbol(piece);
                    pieceElement.className = piece === piece.toUpperCase() ? 'white-piece' : 'black-piece';
                    square.appendChild(pieceElement);
                }
                
                board.appendChild(square);
            }
        }
        
        return board;
    }

    getFinalPosition(moves) {
        try {
            // Create a temporary chess instance to get the final position
            const tempChess = new Chess();
            
            // Parse moves and apply them
            if (moves && moves.trim()) {
                const moveList = moves.split(' ').filter(move => 
                    move && 
                    !move.match(/^\d+\./) && 
                    !move.match(/^[0-9-]+$/) && // Remove result strings like "1-0"
                    move !== '*' // Remove asterisks
                );
                
                for (const move of moveList) {
                    try {
                        tempChess.move(move);
                    } catch (e) {
                        // Skip invalid moves
                        continue;
                    }
                }
            }
            
            // Get the final position
            const board = Array(8).fill(null).map(() => Array(8).fill(null));
            
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    const square = String.fromCharCode(97 + col) + (8 - row);
                    const piece = tempChess.get(square);
                    if (piece) {
                        const pieceSymbol = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
                        board[row][col] = pieceSymbol;
                    }
                }
            }
            
            return board;
        } catch (error) {
            console.error('Error getting final position:', error);
            // Return initial position as fallback
            return [
                ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
                ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
                [null, null, null, null, null, null, null, null],
                [null, null, null, null, null, null, null, null],
                [null, null, null, null, null, null, null, null],
                [null, null, null, null, null, null, null, null],
                ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
                ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
            ];
        }
    }

    getPieceSymbol(piece) {
        // Use more distinctive piece symbols
        const symbols = {
            'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
            'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
            'KK': '♔', 'QQ': '♕', 'RR': '♖', 'BB': '♗', 'NN': '♘', 'PP': '♙',
            'kk': '♚', 'qq': '♛', 'rr': '♜', 'bb': '♝', 'nn': '♞', 'pp': '♟'
        };
        return symbols[piece] || '';
    }

    openGameModal(game) {
        this.currentGame = game;
        this.currentMoveIndex = 0;
        
        // Update modal content
        this.gameTitle.textContent = `${game.white_player || 'White'} vs ${game.black_player || 'Black'}`;
        this.whitePlayerName.textContent = game.white_player || 'Unknown';
        this.blackPlayerName.textContent = game.black_player || 'Unknown';
        this.whitePlayerElo.textContent = game.white_elo ? `(${game.white_elo})` : '';
        this.blackPlayerElo.textContent = game.black_elo ? `(${game.black_elo})` : '';
        this.gameResult.textContent = game.result || 'Unknown';
        this.gameDate.textContent = game.date_played || 'Unknown';
        
        // Handle site field - make it clickable if it's a URL
        const site = game.site || 'Unknown';
        if (site !== 'Unknown' && (site.startsWith('http://') || site.startsWith('https://'))) {
            this.gameSite.innerHTML = `<a href="${site}" target="_blank" rel="noopener noreferrer">${site}</a>`;
        } else {
            this.gameSite.textContent = site;
        }
        
        this.gameOpening.textContent = game.opening || 'Unknown';
        
        // Load the game
        this.loadGame(game);
        
        // Show modal
        this.gameModal.classList.remove('hidden');
    }

    loadGame(game) {
        try {
            console.log('Loading game PGN:', game.pgn_text);
            this.chess.loadPgn(game.pgn_text || '');
            this.gameMoves = [...this.chess.history()]; // Store moves separately
            console.log('Chess history after PGN load:', this.gameMoves);
            this.currentMoveIndex = this.gameMoves.length; // Start at the end
            this.updateBoard();
            this.updateMovesList();
            this.updateMoveControls();
        } catch (error) {
            console.error('Error loading game from PGN:', error);
            // Fallback: try to load from moves string
            this.loadGameFromMoves(game.moves);
        }
    }

    loadGameFromMoves(moves) {
        try {
            console.log('Loading game from moves:', moves);
            this.chess.reset();
            const moveList = moves.split(' ').filter(move => 
                move && 
                !move.match(/^\d+\./) && 
                !move.match(/^[0-9-]+$/) && 
                move !== '*'
            );
            
            console.log('Parsed move list:', moveList);
            
            for (const move of moveList) {
                try {
                    this.chess.move(move);
                    console.log('Applied move:', move);
                } catch (e) {
                    console.log('Invalid move:', move, e.message);
                }
            }
            
            this.gameMoves = [...this.chess.history()]; // Store moves separately
            console.log('Final chess history:', this.gameMoves);
            this.currentMoveIndex = this.gameMoves.length; // Start at the end
            this.updateBoard();
            this.updateMovesList();
            this.updateMoveControls();
        } catch (error) {
            console.error('Error loading game from moves:', error);
        }
    }

    updateBoard() {
        this.chessBoard.innerHTML = '';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.square = `${String.fromCharCode(97 + col)}${8 - row}`;
                
                const piece = this.chess.get(`${String.fromCharCode(97 + col)}${8 - row}`);
                if (piece) {
                    const pieceSymbol = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
                    const pieceElement = document.createElement('span');
                    pieceElement.textContent = this.getPieceSymbol(pieceSymbol);
                    pieceElement.className = `piece ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`;
                    square.appendChild(pieceElement);
                }
                
                this.chessBoard.appendChild(square);
            }
        }
    }


    updateMovesList() {
        this.movesList.innerHTML = '';
        
        for (let i = 0; i < this.gameMoves.length; i += 2) {
            const moveDiv = document.createElement('div');
            moveDiv.className = 'move';
            
            const moveNumber = Math.floor(i / 2) + 1;
            const whiteMove = this.gameMoves[i];
            const blackMove = this.gameMoves[i + 1];
            
            moveDiv.innerHTML = `
                <span class="move-number">${moveNumber}.</span>
                <span class="white-move">${whiteMove}</span>
                ${blackMove ? `<span class="black-move">${blackMove}</span>` : ''}
            `;
            
            moveDiv.addEventListener('click', () => this.goToMoveDirect(i + 1));
            this.movesList.appendChild(moveDiv);
        }
    }

    updateMoveControls() {
        this.currentMoveIndex = Math.min(this.currentMoveIndex, this.gameMoves.length);
        
        this.prevMoveBtn.disabled = this.currentMoveIndex <= 0;
        this.nextMoveBtn.disabled = this.currentMoveIndex >= this.gameMoves.length;
        this.firstMoveBtn.disabled = this.currentMoveIndex <= 0;
        this.lastMoveBtn.disabled = this.currentMoveIndex >= this.gameMoves.length;
    }

    goToMove(moveIndex) {
        console.log('Going to move index:', moveIndex, 'from current:', this.currentMoveIndex);
        
        // If going to start, reset and show starting position
        if (moveIndex === 0) {
            this.chess.reset();
            this.updateBoard();
            this.currentMoveIndex = moveIndex;
            this.updateMoveControls();
            this.highlightCurrentMove();
            return;
        }
        
        // If moving forward from current position, animate only the next move
        if (moveIndex > this.currentMoveIndex) {
            console.log('Moving forward - using animateNextMove');
            this.animateNextMove(moveIndex);
        } else {
            // If going backward, animate only the previous move
            console.log('Moving backward - using animatePreviousMove');
            this.animatePreviousMove(moveIndex);
        }
    }

    goToMoveDirect(moveIndex) {
        console.log('Going directly to move index:', moveIndex);
        
        // Reset chess to starting position
        this.chess.reset();
        
        // Apply all moves up to the target index
        for (let i = 0; i < moveIndex && i < this.gameMoves.length; i++) {
            try {
                this.chess.move(this.gameMoves[i]);
            } catch (e) {
                console.log('Error applying move:', this.gameMoves[i], e.message);
            }
        }
        
        // Update the board and controls
        this.currentMoveIndex = moveIndex;
        this.updateBoard();
        this.updateMoveControls();
        this.highlightCurrentMove();
    }

    async animateNextMove(targetMoveIndex) {
        console.log('Animating next move from', this.currentMoveIndex, 'to', targetMoveIndex);
        
        // Reset chess to current position and replay moves to ensure consistency
        this.chess.reset();
        for (let i = 0; i < this.currentMoveIndex; i++) {
            this.chess.move(this.gameMoves[i]);
        }
        
        // Animate only the moves from current position to target
        for (let i = this.currentMoveIndex; i < targetMoveIndex && i < this.gameMoves.length; i++) {
            try {
                const move = this.gameMoves[i];
                console.log('Processing move', i, ':', move);
                
                // Get the move object before applying it
                const tempChess = new Chess(this.chess.fen());
                const moveObj = tempChess.move(move);
                
                if (moveObj) {
                    console.log('Move object:', moveObj);
                    
                    // Animate the move
                    await this.animateMove(moveObj);
                    
                    // Apply the move to the actual chess instance
                    this.chess.move(move);
                    console.log('Applied move to chess instance');
                    
                    // Update the entire board to ensure consistency
                    this.updateBoard();
                    console.log('Updated board after move');
                } else {
                    console.log('Invalid move object, skipping animation');
                    // Still try to apply the move
                    this.chess.move(move);
                    this.updateBoard();
                }
                
                console.log('Completed move in navigation:', move);
            } catch (e) {
                console.log('Error applying move in navigation:', this.gameMoves[i], e.message);
                // If there's an error, try to continue with the next move
                try {
                    this.chess.move(this.gameMoves[i]);
                    this.updateBoard();
                } catch (e2) {
                    console.log('Failed to apply move even without animation:', e2.message);
                }
            }
        }
        
        this.currentMoveIndex = targetMoveIndex;
        this.updateMoveControls();
        this.highlightCurrentMove();
    }

    async animatePreviousMove(targetMoveIndex) {
        console.log('Animating previous move from', this.currentMoveIndex, 'to', targetMoveIndex);
        
        // For going backward, we'll just undo moves without complex animation
        // This is simpler and more reliable
        for (let i = this.currentMoveIndex - 1; i >= targetMoveIndex; i--) {
            try {
                const move = this.gameMoves[i];
                console.log('Undoing move', i, ':', move);
                
                // Undo the move in the actual chess instance
                this.chess.undo();
                console.log('Undid move in chess instance');
                
                // Update the board to reflect the undone position
                this.updateBoard();
                console.log('Updated board after undo');
                
                // Small delay to make the undo visible
                await new Promise(resolve => setTimeout(resolve, 50));
                
                console.log('Completed undo in navigation:', move);
            } catch (e) {
                console.log('Error undoing move in navigation:', this.gameMoves[i], e.message);
                // If there's an error, just undo without animation
                this.chess.undo();
                this.updateBoard();
            }
        }
        
        this.currentMoveIndex = targetMoveIndex;
        this.updateMoveControls();
        this.highlightCurrentMove();
    }

    async animateMovesToPosition(targetMoveIndex) {
        console.log('Animating moves from 0 to', targetMoveIndex);
        
        // Start from the beginning and animate to target
        for (let i = 0; i < targetMoveIndex && i < this.gameMoves.length; i++) {
            try {
                const move = this.gameMoves[i];
                console.log('Processing move', i, ':', move);
                
                // Get the move object before applying it
                const tempChess = new Chess(this.chess.fen());
                const moveObj = tempChess.move(move);
                
                if (moveObj) {
                    console.log('Move object:', moveObj);
                    
                    // Animate the move
                    await this.animateMove(moveObj);
                    
                    // Apply the move to the actual chess instance
                    this.chess.move(move);
                    console.log('Applied move to chess instance');
                    
                    // Update only the affected squares instead of recreating the board
                    this.updateBoardAfterMove(moveObj);
                    console.log('Updated board after move');
                }
                
                console.log('Completed move in navigation:', move);
            } catch (e) {
                console.log('Error applying move in navigation:', this.gameMoves[i], e.message);
            }
        }
        
        this.currentMoveIndex = targetMoveIndex;
        this.updateMoveControls();
        this.highlightCurrentMove();
    }

    async animateMove(moveObj) {
        return new Promise((resolve) => {
            const fromSquare = document.querySelector(`[data-square="${moveObj.from}"]`);
            const toSquare = document.querySelector(`[data-square="${moveObj.to}"]`);
            
            if (!fromSquare || !toSquare) {
                resolve();
                return;
            }
            
            // Get the piece element from the source square
            const pieceElement = fromSquare.querySelector('.piece');
            if (!pieceElement) {
                resolve();
                return;
            }
            
            // Clone the piece for animation
            const animatedPiece = pieceElement.cloneNode(true);
            animatedPiece.classList.add('moving');
            
            // Position the animated piece at the source
            const fromRect = fromSquare.getBoundingClientRect();
            const toRect = toSquare.getBoundingClientRect();
            const boardRect = this.chessBoard.getBoundingClientRect();
            
            // Calculate positions relative to the board
            const fromX = fromRect.left - boardRect.left;
            const fromY = fromRect.top - boardRect.top;
            const toX = toRect.left - boardRect.left;
            const toY = toRect.top - boardRect.top;
            
            // Use the destination square size for consistent appearance
            const squareSize = Math.min(toRect.width, toRect.height);
            
            animatedPiece.style.position = 'absolute';
            animatedPiece.style.left = fromX + 'px';
            animatedPiece.style.top = fromY + 'px';
            animatedPiece.style.pointerEvents = 'none';
            animatedPiece.style.zIndex = '1000';
            animatedPiece.style.width = squareSize + 'px';
            animatedPiece.style.height = squareSize + 'px';
            animatedPiece.style.margin = '0';
            animatedPiece.style.padding = '0';
            animatedPiece.style.fontSize = (squareSize * 0.8) + 'px'; // Scale font size to square
            animatedPiece.style.display = 'flex';
            animatedPiece.style.alignItems = 'center';
            animatedPiece.style.justifyContent = 'center';
            
            // Make sure the board has relative positioning for absolute children
            if (getComputedStyle(this.chessBoard).position === 'static') {
                this.chessBoard.style.position = 'relative';
            }
            
            this.chessBoard.appendChild(animatedPiece);
            
            // Remove the source piece immediately when animation starts
            pieceElement.remove();
            
            // If there's a capture, hide the captured piece
            const capturedPiece = toSquare.querySelector('.piece');
            if (capturedPiece) {
                capturedPiece.style.opacity = '0';
            }
            
            // Small delay to ensure the piece is rendered before animation
            requestAnimationFrame(() => {
                // Animate only position, not size - very fast timing
                animatedPiece.style.transition = 'left 0.1s ease-in-out, top 0.1s ease-in-out';
                animatedPiece.style.left = toX + 'px';
                animatedPiece.style.top = toY + 'px';
            });
            
            // After animation completes
            setTimeout(() => {
                // Remove animated piece
                animatedPiece.remove();
                resolve();
            }, 100);
        });
    }

    async animateReverseMove(moveObj) {
        return new Promise((resolve) => {
            const fromSquare = document.querySelector(`[data-square="${moveObj.from}"]`);
            const toSquare = document.querySelector(`[data-square="${moveObj.to}"]`);
            
            if (!fromSquare || !toSquare) {
                resolve();
                return;
            }
            
            // Get the piece element from the destination square (where it currently is)
            const pieceElement = toSquare.querySelector('.piece');
            if (!pieceElement) {
                resolve();
                return;
            }
            
            // Clone the piece for animation
            const animatedPiece = pieceElement.cloneNode(true);
            animatedPiece.classList.add('moving');
            
            // Position the animated piece at the current location (destination)
            const fromRect = fromSquare.getBoundingClientRect();
            const toRect = toSquare.getBoundingClientRect();
            const boardRect = this.chessBoard.getBoundingClientRect();
            
            // Calculate positions relative to the board
            const fromX = fromRect.left - boardRect.left;
            const fromY = fromRect.top - boardRect.top;
            const toX = toRect.left - boardRect.left;
            const toY = toRect.top - boardRect.top;
            
            // Use the source square size for consistent appearance
            const squareSize = Math.min(fromRect.width, fromRect.height);
            
            animatedPiece.style.position = 'absolute';
            animatedPiece.style.left = toX + 'px'; // Start at current position
            animatedPiece.style.top = toY + 'px';
            animatedPiece.style.pointerEvents = 'none';
            animatedPiece.style.zIndex = '1000';
            animatedPiece.style.width = squareSize + 'px';
            animatedPiece.style.height = squareSize + 'px';
            animatedPiece.style.margin = '0';
            animatedPiece.style.padding = '0';
            animatedPiece.style.fontSize = (squareSize * 0.8) + 'px';
            animatedPiece.style.display = 'flex';
            animatedPiece.style.alignItems = 'center';
            animatedPiece.style.justifyContent = 'center';
            
            // Make sure the board has relative positioning for absolute children
            if (getComputedStyle(this.chessBoard).position === 'static') {
                this.chessBoard.style.position = 'relative';
            }
            
            this.chessBoard.appendChild(animatedPiece);
            
            // Remove the current piece immediately when animation starts
            pieceElement.remove();
            
            // Small delay to ensure the piece is rendered before animation
            requestAnimationFrame(() => {
                // Animate back to source position
                animatedPiece.style.transition = 'left 0.1s ease-in-out, top 0.1s ease-in-out';
                animatedPiece.style.left = fromX + 'px'; // Move back to source
                animatedPiece.style.top = fromY + 'px';
            });
            
            // After animation completes
            setTimeout(() => {
                // Remove animated piece
                animatedPiece.remove();
                resolve();
            }, 100);
        });
    }

    previousMove() {
        if (this.currentMoveIndex > 0) {
            this.goToMove(this.currentMoveIndex - 1);
        }
    }

    nextMove() {
        if (this.currentMoveIndex < this.gameMoves.length) {
            this.goToMove(this.currentMoveIndex + 1);
        }
    }

    goToFirstMove() {
        this.currentMoveIndex = 0;
        this.chess.reset();
        this.updateBoard();
        this.updateMoveControls();
        this.highlightCurrentMove();
    }

    goToLastMove() {
        this.currentMoveIndex = this.gameMoves.length;
        this.chess.reset();
        this.updateBoard();
        this.animateMovesToPosition(this.gameMoves.length);
    }

    handleKeyPress(e) {
        const isModalOpen = !this.gameModal.classList.contains('hidden');
        console.log('Key pressed:', e.key, 'Modal open:', isModalOpen);
        
        // Only handle keyboard navigation when game modal is open
        if (!isModalOpen) {
            console.log('Modal not open, ignoring key press');
            return;
        }
        
        // Prevent default behavior for arrow keys
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
        }
        
        switch (e.key) {
            case 'ArrowLeft':
                console.log('Left arrow - going to previous move');
                this.previousMove();
                break;
            case 'ArrowRight':
                console.log('Right arrow - going to next move');
                this.nextMove();
                break;
        }
    }

    highlightCurrentMove() {
        // Remove previous highlights
        document.querySelectorAll('.move.current').forEach(move => {
            move.classList.remove('current');
        });
        
        // Highlight current move
        const moves = this.movesList.querySelectorAll('.move');
        const moveIndex = Math.floor((this.currentMoveIndex - 1) / 2);
        if (moves[moveIndex]) {
            moves[moveIndex].classList.add('current');
        }
    }

    closeGameModal() {
        this.gameModal.classList.add('hidden');
        this.currentGame = null;
    }

    showLoading(show) {
        if (show) {
            this.loadingIndicator.classList.remove('hidden');
        } else {
            this.loadingIndicator.classList.add('hidden');
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove('hidden');
    }

    hideError() {
        this.errorMessage.classList.add('hidden');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChessQLApp();
});
