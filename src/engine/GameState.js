/**
 * GameState - Central game state manager
 */
export class GameState {
    constructor(options = {}) {
        this.maxHealth = options.maxHealth || 100;
        this.health = this.maxHealth;
        this.score = 0;
        this.isGameOver = false;

        // Callbacks
        this.onHealthChange = options.onHealthChange || null;
        this.onScoreChange = options.onScoreChange || null;
        this.onGameOver = options.onGameOver || null;
    }

    takeDamage(amount) {
        if (this.isGameOver) return;

        this.health = Math.max(0, this.health - amount);

        if (this.onHealthChange) {
            this.onHealthChange(this.health, this.maxHealth);
        }

        if (this.health <= 0) {
            this.isGameOver = true;
            if (this.onGameOver) {
                this.onGameOver(this.score);
            }
        }
    }

    heal(amount) {
        if (this.isGameOver) return;

        this.health = Math.min(this.maxHealth, this.health + amount);

        if (this.onHealthChange) {
            this.onHealthChange(this.health, this.maxHealth);
        }
    }

    addScore(amount) {
        this.score += amount;

        if (this.onScoreChange) {
            this.onScoreChange(this.score);
        }
    }

    reset() {
        this.health = this.maxHealth;
        this.score = 0;
        this.isGameOver = false;

        if (this.onHealthChange) {
            this.onHealthChange(this.health, this.maxHealth);
        }
        if (this.onScoreChange) {
            this.onScoreChange(this.score);
        }
    }

    getState() {
        return {
            health: this.health,
            maxHealth: this.maxHealth,
            score: this.score,
            isGameOver: this.isGameOver
        };
    }
}
