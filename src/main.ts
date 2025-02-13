import './style.css';
import { GalaxyScene } from './scenes/examples/AudioScene';

window.addEventListener('DOMContentLoaded', () => {
    try {
        const scene = new GalaxyScene();
        scene.start();
    } catch (error) {
        console.error('Failed to initialize scene:', error);
    }
}); 