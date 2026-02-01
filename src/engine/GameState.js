/**
 * GameState - Central game state manager
 */
export class GameState {
    constructor(options = {}) {
        this.isGameOver = false;

        // Callbacks
        this.onGameOver = options.onGameOver || null;
    }

    endGame() {
        this.isGameOver = true;
        if (this.onGameOver) {
            this.onGameOver();
        }
    }

    reset() {
        this.isGameOver = false;
    }

    getState() {
        return {
            isGameOver: this.isGameOver
        };
    }
}
