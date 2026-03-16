import * as CANNON from 'cannon-es';

export class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);

        // High friction contact material
        const blockMaterial = new CANNON.Material('blockMaterial');
        const groundMaterial = new CANNON.Material('groundMaterial');

        const blockGroundContact = new CANNON.ContactMaterial(blockMaterial, groundMaterial, {
            friction: 0.5,
            restitution: 0.1
        });

        const blockBlockContact = new CANNON.ContactMaterial(blockMaterial, blockMaterial, {
            friction: 0.8, // High friction to prevent sliding
            restitution: 0.1
        });

        this.world.addContactMaterial(blockGroundContact);
        this.world.addContactMaterial(blockBlockContact);

        this.blockMaterial = blockMaterial;
        this.groundMaterial = groundMaterial;
    }

    createGround() {
        const groundBody = new CANNON.Body({
            mass: 0, // static
            shape: new CANNON.Plane(),
            material: this.groundMaterial
        });
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(groundBody);
        return groundBody;
    }

    createBlockBody(x, y, z, width, height, depth, mass = 1) {
        const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
        const body = new CANNON.Body({
            mass: mass,
            shape: shape,
            material: this.blockMaterial,
            position: new CANNON.Vec3(x, y, z)
        });
        this.world.addBody(body);
        return body;
    }

    step(dt) {
        this.world.step(dt);
    }
}
