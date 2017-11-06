
import { Game } from '../game'
import * as Utils from '../utils/utils'
import { GRenderer, GPoint } from "../renderer/gRenderer";


export class Play extends Phaser.State {

    /**
     * Creates an instance of Play.
     * @param {Game} game 
     * @memberof Play
     */
    constructor(game: Game) {
        super();
        this.mGame = game;
    }

    /**
     * Initialize utility variables. Preload required assets.
     * 
     * @memberof Play
     */
    public preload(): void {
        this.mWorldBoundHorizontalSpan = Utils.deviceConfig.worldBoundHorizontalSpan();
        this.mWorldBoundVerticalSpan = Utils.deviceConfig.worldBoundVerticalSpan();
    }

    /**
     * Create your initail gameplay state.
     * 
     * @memberof Play
     */
    public create(): void {

        this.game.physics.startSystem(Phaser.Physics.P2JS);
        this.game.physics.p2.gravity.y = 770 * Utils.deviceConfig.scaleFactor();
        this.game.physics.p2.restitution = 0.2;
        this.game.physics.p2.friction = 5;
        this.game.input.enabled = true;

        //this.time.desiredFps = 60;
        //this.time.physicsElapsed = 1 / this.time.desiredFps;
        //this.game.physics.p2.frameRate = 1 / 60;
        this.game.physics.p2.useElapsedTime = true;

        this.game.clearBeforeRender = false;
        this.game.lockRender = true;

        if (!window.document.getElementById("fpsText").hasChildNodes()) {
            this.mFpsText = window.document.createTextNode("");
            window.document.getElementById("fpsText").appendChild(this.mFpsText);
        }
        else this.mFpsText = window.document.getElementById("fpsText").firstChild as Text;
        this.mFps = 0;

        window.document.getElementById('versionText').textContent = "git_r:" + GIT_REVISION;
        this.game.clearBeforeRender = false;

        this.mHalfUpdateTimer = this.game.time.create(true);
        this.mHalfUpdateTimer.loop(0.5 * Phaser.Timer.SECOND, this.updateHalfSecond, this);
        this.mHalfUpdateTimer.start();

        (<HTMLBodyElement>window.document.getElementById("body")).style.backgroundColor = '#F6F6F8';

        this.gRenderer = new GRenderer(this.game);
        this.gRenderer.useProgram();
        this.createPath();
    }


    /**
     * Creates a random path for gl_repeat test.
     * 
     * @private
     * @memberof Play
     */
    private createPath() {
        this.mGame.world.setBounds(0, 0, this.mWorldBoundHorizontalSpan * 3 * Utils.deviceConfig.scaleFactor(), this.mWorldBoundVerticalSpan);

        let interpolatedPoints: GPoint[] = [];
        let width = this.game.world.width * 1.5;
        let wavelength = Math.floor(800 * Utils.deviceConfig.scaleFactor());
        let amplitude = Math.floor(900 * Utils.deviceConfig.scaleFactor());
        let x = 0;
        let a = 0;
        let b = 0;
        while (x < width) {
            if (x % wavelength === 0) {
                a = b;
                b = Math.random();
                interpolatedPoints.push({ x: x, y: a * amplitude });
            } else {
                let y = Utils.functions.Interpolate(a, b, (x % wavelength) / wavelength) * amplitude;
                interpolatedPoints.push({ x: x, y: y });
            }
            ++x;
        }
        let gpoints: GPoint[] = [];
        let skipFactor = Math.floor(300 * Utils.deviceConfig.scaleFactor());
        for (let i = 0; i + skipFactor < interpolatedPoints.length; i += skipFactor) {
            gpoints.push({ x: interpolatedPoints[i].x, y: interpolatedPoints[i].y });
            gpoints.push({ x: interpolatedPoints[i + skipFactor].x, y: interpolatedPoints[i + skipFactor].y });
        }
        this.gRenderer.addRawRepeatingTexture(gpoints, 'untitled');
    }

    /**
     * Don't do too much here!
     * 
     * @memberof Play
     */
    public update(): void {
        //let current = 1000 / this.game.time.elapsedMS;
        //this.mFps = (this.mFps * 0.9) + (current * (1.0 - 0.9))
        // ==>
        this.mFps = (this.mFps * 0.9) + (100 / this.game.time.elapsedMS)
        this.gRenderer.render();

        if (this.game.input.activePointer.isDown) {
            if (this.mDragPointer) {
                this.game.camera.x += this.mDragPointer.x - this.game.input.activePointer.position.x;
                this.game.camera.y += this.mDragPointer.y - this.game.input.activePointer.position.y;
            }	
            this.mDragPointer = this.game.input.activePointer.position.clone();
        }
        else this.mDragPointer = null;
    }

    /**
     * Cleanup.
     * 
     * @memberof Play
     */
    public shutdown(): void {

        if (this.mHalfUpdateTimer) {
            this.mHalfUpdateTimer.destroy();
            this.mHalfUpdateTimer = null;
        }
        if (this.gRenderer) {
            this.gRenderer.shutdown();
        }
        this.stage.removeChildren();
        this.stage.addChild(this.game.world);
        this.stage.addChild(this.camera.fx);
    }

    /**
     * Render!
     * 
     * @memberof Play
     */
    public render() {
        this.gRenderer.useProgram();
        this.gRenderer.render();
        this.gRenderer.restoreProgram();
    }

    /**
     * Periodic tasks that don't need to be real time.
     * 
     * @memberof Play
     */
    public updateHalfSecond() {
        this.mFpsText.nodeValue = this.mFps.toFixed(0);
    }


    private mGame: Game;
    private gRenderer: GRenderer;

    private mWorldBoundHorizontalSpan: number;
    private mWorldBoundVerticalSpan: number;
    private mDragPointer;

    private mHalfUpdateTimer: Phaser.Timer;
    private mFpsText: Text;
    private mFps: number;
}