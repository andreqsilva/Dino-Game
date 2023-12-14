import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { math } from '/Dino-Game/src/js/math.js';

// Scene 
const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.background = new THREE.Color().setHSL(0.3, 0, 1);
scene.fog = new THREE.Fog(scene.background, 1, 5000);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(-100, 45, 30);
const target = new THREE.Vector3(500, 0, 0);
camera.lookAt(target);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
renderer.shadowMap.enabled = true;

// texto com a pontuação
const scoreElement = document.createElement('div');
scoreElement.style.position = 'absolute';
scoreElement.style.top = '20px';
scoreElement.style.left = '20px';
scoreElement.style.color = 'yellow';
scoreElement.style.fontFamily = 'Arial';
scoreElement.style.fontSize = '30px';
document.body.appendChild(scoreElement);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
hemiLight.color.setHSL(0.6, 1, 0.6);
hemiLight.groundColor.setHSL(0.095, 1, 0.75);
hemiLight.position.set(0, 60, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.color.setHSL(0.1, 1, 0.95);
dirLight.position.set(1, 1.75, -1);
dirLight.position.multiplyScalar(80);
scene.add(dirLight);

dirLight.castShadow = true;

dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;

const d = 50;

dirLight.shadow.camera.left = - d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = - d;

dirLight.shadow.camera.far = 3500;
dirLight.shadow.bias = - 0.0001;

// Plane
const soloTexture = new THREE.TextureLoader().load('/Dino-Game/assets/solo.jpg'); // sugestão: colocar solo de deserto
const planeGeometry = new THREE.PlaneGeometry(10000, 10000);
const planeMaterial = new THREE.MeshLambertMaterial({ map: soloTexture });

planeMaterial.map.wrapS = THREE.RepeatWrapping;
planeMaterial.map.wrapT = THREE.RepeatWrapping;
planeMaterial.map.repeat.set(50, 50);

const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

function updatePlane() {
    plane.position.x -= 3;
    // Se o plano ultrapassar uma certa distância, reposicione-o para criar um loop
    if (plane.position.x < -5000) {
        plane.position.x = 0;
    }
}

// Skydome
const vertexShader = document.getElementById('vertexShader').textContent;
const fragmentShader = document.getElementById('fragmentShader').textContent;
const uniforms = {
    'topColor': { value: new THREE.Color(0x0077ff) },
    'bottomColor': { value: new THREE.Color(0xffffff) },
    'offset': { value: 33 },
    'exponent': { value: 0.6 }
};
uniforms['topColor'].value.copy(hemiLight.color);

scene.fog.color.copy(uniforms['bottomColor'].value);

const skyGeo = new THREE.SphereGeometry(4000, 32, 15);
const skyMat = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    side: THREE.BackSide
});

const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

let score = 0; // pontuação

// velocidade que o dino irá se movimentar no eixo z
const dinoSpeed = 2;
let dino;
let mixer;

function loadPlayer() {
    const loader = new GLTFLoader();
    loader.load('/Dino-Game/assets/tyranno/scene.gltf', function (gltf) {
        dino = gltf.scene;
        dino.scale.set(10, 10, 10);
        dino.position.x = -20;

        dino.traverse((child) => {
            if (child.isMesh) {
                // configurações de sobra
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.shadowSide = THREE.DoubleSide;
            }
        });

        scene.add(dino);

        mixer = new THREE.AnimationMixer(dino);
        const action = mixer.clipAction(gltf.animations[8]);
        action.play();
    });
}

// importando as nuvens
const cloudLoader = new GLTFLoader();
const numClouds = 20; // número de nuvens geradas
let cloud

cloudLoader.setPath('/Dino-Game/assets/Clouds/GLTF/');
for (let i = 0; i < numClouds; i++) {
    cloudLoader.load('Cloud' + math.rand_int(1, 3) + '.glb', function (glb) { // temos 3 modelos de nuvem
        cloud = glb.scene;
        cloud.position.x = math.rand_range(0, 2000);
        cloud.position.y = math.rand_range(100, 200);
        cloud.position.z = math.rand_range(-1000, 1000);

        let s = math.rand_range(10, 20); // escala aleatória para representar diferentes formatos de nuvens
        cloud.scale.set(s, s, s);

        const q = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0), math.rand_range(0, 360));
        cloud.quaternion.copy(q);

        cloud.traverse(c => {
            if (c.geometry) {
                c.geometry.computeBoundingBox();
            }

            let materials = c.material;
            if (!(c.material instanceof Array)) {
                materials = [c.material];
            }

            for (let m of materials) {
                if (m) {
                    m.specular = new THREE.Color(0x000000);
                    m.emissive = new THREE.Color(0xC0C0C0);
                }
            }
            c.castShadow = false;
            c.receiveShadow = false;
        });

        scene.add(cloud);
    });
}

// Obstáculos

const obstacleGroup = new THREE.Group();
scene.add(obstacleGroup);

// velocidade que os obstáculos aparecem na cena
// uma sugestão é aumetar a velocidade conforme o jogador
// for avançando no jogo
const obstacleSpeed = 4;

function createObstacle() {
    const loader = new GLTFLoader();

    // número de obstáculos que serão gerados a cada atualização
    const numObstacles = 3;

    for (let i = 0; i < numObstacles; i++) {
        loader.load('/Dino-Game/assets/DesertPack/Cactus1.glb', function (gltf) {
            const obstacle = gltf.scene;
            obstacle.position.x = 500;
            obstacle.position.z = Math.random() * 100 - 50;
            obstacle.position.y = 20;
            obstacle.scale.set(30, 30, 30);

            obstacle.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            });

            obstacleGroup.add(obstacle);
        });
    }
}

function updateObstacles() {
    obstacleGroup.children.forEach(obstacle => {
        obstacle.position.x -= obstacleSpeed;

        if (obstacle.position.x < -500) {
            obstacle.position.x = 500;
            obstacle.position.z = Math.random() * 100 - 50;
        }
    });
}

// Moedas
const coinsGroup = new THREE.Group();
scene.add(coinsGroup);

const coinLoader = new GLTFLoader();

function createCoin() {
    coinLoader.load('/Dino-Game/assets/Coin/coin.glb', function (gltf) {
        const coin = gltf.scene;
        coin.position.x = Math.random() * 2000 - 1000;
        coin.position.z = Math.random() * 200 - 100;
        coin.position.y = 10;
        coin.rotation.y = Math.PI / 3;

        coin.scale.set(2, 2, 2);

        coin.traverse(c => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
            }
        });
        coinsGroup.add(coin);
    });
}

function updateCoins() {
    coinsGroup.children.forEach(coin => {
        coin.position.x -= 4;
        coin.position.y = 10;

        if (coin.position.x < -1000) {
            // Reposicione a moeda se ela sair do campo de visão
            coin.position.x = Math.random() * 2000 - 1000;
            coin.position.z = Math.random() * 200 - 100;
            coin.position.y = 10;
        }

        // Verifique a colisão com o dinossauro
        const playerBox = new THREE.Box3().setFromObject(dino);
        const coinBox = new THREE.Box3().setFromObject(coin);

        if (playerBox.intersectsBox(coinBox)) {
            collectCoin();
            // Reposicione a moeda para gerar em outro lugar após ser coletada
            coin.position.x = Math.random() * 2000 - 1000;
            coin.position.z = Math.random() * 200 - 100;
        }
    });
}

function collectCoin() {
    // atualiza a pontuação
    score++;
    updateScoreText();
}

function updateScoreText() {
    // atualiza o texto exibido na tela
    scoreElement.textContent = 'Moedas coletadas: ' + score;
}

// função que checa a colisão de objetos
function checkCollision() {
    const playerBox = new THREE.Box3().setFromObject(dino);

    obstacleGroup.children.forEach((obstacle) => {
        const obstacleBox = new THREE.Box3().setFromObject(obstacle);

        if (playerBox.intersectsBox(obstacleBox)) {
            alert('Você coletou ' + score + ' moedas!');
            score = 0;
            resetGame();
        }
    });
}

function resetGame() {
    // reposicione o dinossauro e os obstáculos para reiniciar o jogo
    dino.position.set(-20, 0, 0);

    obstacleGroup.children.forEach((obstacle) => {
        obstacle.position.x = Math.random() * 100 - 50;
        obstacle.position.z = camera.position.z - Math.random() * 100 - 50;
    });
}

function handlePlayerControls() {
    window.addEventListener('keydown', (event) => {
        switch (event.key) {
            case 'a':
                dino.position.z -= dinoSpeed; // esquerda
                break;
            case 'd': // direita
                dino.position.z += dinoSpeed;
                break;
        }
    });
}

const params = {
    toggleObstacles: function () {
        obstacleGroup.visible = !obstacleGroup.visible;
    }
};

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    updateObstacles();
    updatePlane();
    updateCoins();
    checkCollision();

    updateScoreText();

    renderer.render(scene, camera);
}

loadPlayer();
handlePlayerControls();
createObstacle();
createCoin();
animate();
