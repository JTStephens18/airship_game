import * as THREE from 'three/webgpu';
import { Enemy } from './Enemy.js';

/**
 * EnemyManager - Spawns and manages enemies
 */
export class EnemyManager {
    constructor(scene, options = {}) {
        this.scene = scene;

        // Spawning config
        this.spawnRate = options.spawnRate || 3; // seconds between spawns
        this.spawnDistance = options.spawnDistance || 30; // spawn radius from player
        this.maxEnemies = options.maxEnemies || 15;
        this.waveSize = options.waveSize || 3;

        // Difficulty scaling
        this.difficultyMultiplier = 1.0;
        this.difficultyGrowth = 0.05; // 5% increase per wave

        // State
        this.enemies = [];
        this.spawnTimer = 2; // Initial delay before first spawn
        this.waveCount = 0;
        this.isActive = true;
    }

    /**
     * Update all enemies and handle spawning
     */
    update(delta, playerPos, gameState) {
        if (!this.isActive) return;

        // Spawn timer
        this.spawnTimer -= delta;
        if (this.spawnTimer <= 0 && this.enemies.length < this.maxEnemies) {
            this.spawnWave(playerPos);
            this.spawnTimer = this.spawnRate / this.difficultyMultiplier;
        }

        // Update enemies and collect dead ones for disposal
        const toRemove = [];
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const readyToDispose = enemy.update(delta, playerPos);

            if (readyToDispose) {
                toRemove.push(i);
            }
        }

        // Remove and dispose dead enemies
        for (const idx of toRemove) {
            const enemy = this.enemies[idx];
            enemy.dispose();
            this.enemies.splice(idx, 1);
        }
    }

    /**
     * Spawn a wave of enemies around the player
     */
    spawnWave(playerPos) {
        const count = Math.min(
            this.waveSize + Math.floor(this.waveCount * 0.5),
            this.maxEnemies - this.enemies.length
        );

        for (let i = 0; i < count; i++) {
            // Random angle for spawn position
            const angle = Math.random() * Math.PI * 2;
            const distance = this.spawnDistance + Math.random() * 10;

            const spawnPos = new THREE.Vector3(
                playerPos.x + Math.cos(angle) * distance,
                playerPos.y + (Math.random() - 0.5) * 4, // Slight height variation
                playerPos.z + Math.sin(angle) * distance
            );

            const enemy = new Enemy(this.scene, spawnPos, {
                health: 1,
                speed: 3 + this.difficultyMultiplier * 0.5,
                damage: 10
            });

            this.enemies.push(enemy);
        }

        this.waveCount++;
        this.difficultyMultiplier += this.difficultyGrowth;
    }

    /**
     * Get all active enemies (for collision checks)
     */
    getEnemies() {
        return this.enemies.filter(e => !e.isDead);
    }

    /**
     * Handle enemy death
     */
    onEnemyKilled(enemy, gameState) {
        gameState.addScore(100);
    }

    /**
     * Reset for new game
     */
    reset() {
        for (const enemy of this.enemies) {
            enemy.dispose();
        }
        this.enemies = [];
        this.spawnTimer = 2;
        this.waveCount = 0;
        this.difficultyMultiplier = 1.0;
        this.isActive = true;
    }

    dispose() {
        for (const enemy of this.enemies) {
            enemy.dispose();
        }
        this.enemies = [];
    }
}
