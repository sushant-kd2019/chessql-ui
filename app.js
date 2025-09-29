const { ipcRenderer } = require('electron');
const { Chess } = require('chess.js');

class ChessQLApp {
    constructor() {
        this.currentGames = [];
        this.currentGame = null;
        this.currentMoveIndex = 0;
        this.chess = new Chess();
        
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
        this.gameOpening = document.getElementById('gameOpening');
        
        // Move controls
        this.prevMove = document.getElementById('prevMove');
        this.nextMove = document.getElementById('nextMove');
        this.firstMove = document.getElementById('firstMove');
        this.lastMove = document.getElementById('lastMove');
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
        this.prevMove.addEventListener('click', () => this.previousMove());
        this.nextMove.addEventListener('click', () => this.nextMove());
        this.firstMove.addEventListener('click', () => this.firstMove());
        this.lastMove.addEventListener('click', () => this.lastMove());
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
                    square.textContent = this.getPieceSymbol(piece);
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
        this.gameOpening.textContent = game.opening || 'Unknown';
        
        // Load the game
        this.loadGame(game);
        
        // Show modal
        this.gameModal.classList.remove('hidden');
    }

    loadGame(game) {
        try {
            this.chess.loadPgn(game.pgn_text || '');
            this.updateBoard();
            this.updateMovesList();
            this.updateMoveControls();
        } catch (error) {
            console.error('Error loading game:', error);
            // Fallback: try to load from moves string
            this.loadGameFromMoves(game.moves);
        }
    }

    loadGameFromMoves(moves) {
        try {
            this.chess.reset();
            const moveList = moves.split(' ').filter(move => move && !move.match(/^\d+\./));
            
            for (const move of moveList) {
                if (move && !move.match(/^\d+\./)) {
                    this.chess.move(move);
                }
            }
            
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
                
                const piece = this.chess.get(`${String.fromCharCode(97 + col)}${8 - row}`);
                if (piece) {
                    const pieceSymbol = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
                    square.textContent = this.getPieceSymbol(pieceSymbol);
                }
                
                this.chessBoard.appendChild(square);
            }
        }
    }

    updateMovesList() {
        this.movesList.innerHTML = '';
        const history = this.chess.history();
        
        for (let i = 0; i < history.length; i += 2) {
            const moveDiv = document.createElement('div');
            moveDiv.className = 'move';
            
            const moveNumber = Math.floor(i / 2) + 1;
            const whiteMove = history[i];
            const blackMove = history[i + 1];
            
            moveDiv.innerHTML = `
                <span class="move-number">${moveNumber}.</span>
                <span class="white-move">${whiteMove}</span>
                ${blackMove ? `<span class="black-move">${blackMove}</span>` : ''}
            `;
            
            moveDiv.addEventListener('click', () => this.goToMove(i));
            this.movesList.appendChild(moveDiv);
        }
    }

    updateMoveControls() {
        const history = this.chess.history();
        this.currentMoveIndex = Math.min(this.currentMoveIndex, history.length);
        
        this.prevMove.disabled = this.currentMoveIndex <= 0;
        this.nextMove.disabled = this.currentMoveIndex >= history.length;
        this.firstMove.disabled = this.currentMoveIndex <= 0;
        this.lastMove.disabled = this.currentMoveIndex >= history.length;
    }

    goToMove(moveIndex) {
        this.currentMoveIndex = moveIndex;
        this.chess.reset();
        
        const history = this.chess.history();
        for (let i = 0; i < moveIndex; i++) {
            this.chess.move(history[i]);
        }
        
        this.updateBoard();
        this.updateMoveControls();
        this.highlightCurrentMove();
    }

    previousMove() {
        if (this.currentMoveIndex > 0) {
            this.currentMoveIndex--;
            this.goToMove(this.currentMoveIndex);
        }
    }

    nextMove() {
        const history = this.chess.history();
        if (this.currentMoveIndex < history.length) {
            this.currentMoveIndex++;
            this.goToMove(this.currentMoveIndex);
        }
    }

    firstMove() {
        this.currentMoveIndex = 0;
        this.chess.reset();
        this.updateBoard();
        this.updateMoveControls();
        this.highlightCurrentMove();
    }

    lastMove() {
        const history = this.chess.history();
        this.currentMoveIndex = history.length;
        this.chess.reset();
        for (const move of history) {
            this.chess.move(move);
        }
        this.updateBoard();
        this.updateMoveControls();
        this.highlightCurrentMove();
    }

    highlightCurrentMove() {
        // Remove previous highlights
        document.querySelectorAll('.move.current').forEach(move => {
            move.classList.remove('current');
        });
        
        // Highlight current move
        const moves = this.movesList.querySelectorAll('.move');
        if (moves[this.currentMoveIndex]) {
            moves[this.currentMoveIndex].classList.add('current');
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
