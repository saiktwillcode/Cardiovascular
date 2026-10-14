/**
 * API Client for Cardiovascular Risk & 3D Stenosis System
 */

const API = {
    baseUrl: '', // relative to origin

    async checkHealth() {
        const res = await fetch(`${this.baseUrl}/api/health`);
        return await res.json();
    },

    async getMetadata() {
        const res = await fetch(`${this.baseUrl}/api/metadata`);
        return await res.json();
    },

    async getSamplePatients() {
        const res = await fetch(`${this.baseUrl}/api/patients`);
        return await res.json();
    },

    async getMetrics() {
        const res = await fetch(`${this.baseUrl}/api/metrics`);
        return await res.json();
    },

    async predict(features) {
        const res = await fetch(`${this.baseUrl}/api/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ features })
        });
        if (!res.ok) {
            throw new Error(`Prediction API Error: ${res.statusText}`);
        }
        return await res.json();
    },

    async simulateExercise(features, exerciseType, weeksActive = 12) {
        const res = await fetch(`${this.baseUrl}/api/simulate-exercise`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                features: features,
                exercise_type: exerciseType,
                weeks_active: weeksActive
            })
        });
        if (!res.ok) {
            throw new Error(`Exercise Simulation API Error: ${res.statusText}`);
        }
        return await res.json();
    }
};
