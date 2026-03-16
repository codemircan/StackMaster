import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Tower {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.blocks = []; // Array of { mesh, body }

        this.blockWidth = 1;
        this.blockHeight = 0.6;
        this.blockDepth = 3;
        this.spacing = 0.02; // Tiny gap between blocks to prevent initial explosion
    }

    generate(levels = 18) {
        for (let l = 0; l < levels; l++) {
            const isEven = l % 2 === 0;
            const y = l * (this.blockHeight) + this.blockHeight / 2;

            for (let i = 0; i < 3; i++) {
                // Offset for 3 blocks to be centered around 0
                const offset = (i - 1) * (this.blockWidth + this.spacing);

                let x, z, w, h, d;
                if (isEven) {
                    x = offset;
                    z = 0;
                    w = this.blockWidth;
                    h = this.blockHeight;
                    d = this.blockDepth;
                } else {
                    x = 0;
                    z = offset;
                    w = this.blockDepth;
                    h = this.blockHeight;
                    d = this.blockWidth;
                }

                this.createBlock(x, y, z, w, h, d);
            }
        }
    }

    /**
     * Creates a Jenga block with both visual (Three.js) and physical (Cannon.js) components.
     */
    createBlock(x, y, z, w, h, d) {
        // Visual
        const geometry = new THREE.BoxGeometry(w, h, d);

        // Procedural wood color
        const baseColor = new THREE.Color(0x8B4513); // SaddleBrown
        const variation = Math.random() * 0.2;
        const color = baseColor.clone().offsetHSL(0, 0, variation - 0.1);

        const material = new THREE.MeshStandardMaterial({ color: color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(x, y, z);
        this.scene.add(mesh);

        // Physics
        const body = this.physicsWorld.createBlockBody(x, y, z, w, h, d);

        this.blocks.push({ mesh, body, initialY: y });
    }

    update() {
        this.blocks.forEach(block => {
            block.mesh.position.copy(block.body.position);
            block.mesh.quaternion.copy(block.body.quaternion);
        });
    }

    reset() {
        this.blocks.forEach(block => {
            this.scene.remove(block.mesh);
            block.mesh.geometry.dispose();
            block.mesh.material.dispose();
            this.physicsWorld.world.removeBody(block.body);
        });
        this.blocks = [];
    }
}
