import GameState from "../../Controller/CommonUI/GameState";
import MultiGameFlowController from "../../Controller/Multi/MultiFlowController";

const { ccclass, property } = cc._decorator;

@ccclass
export default class Multiplayer extends cc.Component {
    @property(cc.Prefab) scoreDisplayPrefab: cc.Prefab = null;
    @property(cc.Prefab) timerDisplayPrefab: cc.Prefab = null;

    @property(cc.Node) correctSign: cc.Node = null;
    @property(cc.Node) wrongSign: cc.Node = null;

    @property(cc.Label) sequenceLabel: cc.Label = null;
    @property(cc.Label) input_label: cc.Label = null;
    @property(cc.Label) random_label: cc.Label = null;

    @property(cc.Node) layout: cc.Node = null;

    @property(cc.Sprite) reverseLabel: cc.Sprite = null;

    @property(cc.Sprite) verseLabel: cc.Sprite = null;

    private numbersToShow: number[] = [];
    private userInput: number[] = [];
    private isReverseMode: boolean = false;
    private correctCount: number = 0;
    private score: number = 0;
    private questionLength: number = 3;
    private timer: number = 30;
    private scoreLabel: cc.Label = null;
    private timerLabel: cc.Label = null;

    private inputEnabled: boolean = false;
    public isGameOver: boolean = false;

    private lastSentQuestion: { numbers: number[], direction: string } = null;

    startGame() {
        this.initScoreUI();
        this.initTimerUI();
        this.schedule(this.decreaseTimer, 1);
        this.showNewQuestion();
        this.registerButtons();

        window.socket.on("game-event", (data) => {
            if (data.type === "guest-ready") {
                const roomId = GameState.createdRoomId || GameState.incomingRoomId;
                if (GameState.isHost && this.lastSentQuestion) {
                    console.log("[DEBUG] guest-ready 수신 → 마지막 문제 재전송");
                    window.socket.emit("game-event", {
                        type: "spawn-question",
                        roomId,
                        payload: this.lastSentQuestion
                    });
                }
            }
        });
    }

    initScoreUI() {
        const scoreNode = cc.instantiate(this.scoreDisplayPrefab);
        this.node.addChild(scoreNode);
        this.scoreLabel = scoreNode.getChildByName("ScoreLabel").getComponent(cc.Label);
        this.updateScoreLabel();
    }

    initTimerUI() {
        const timerNode = cc.instantiate(this.timerDisplayPrefab);
        this.node.addChild(timerNode);
        this.timerLabel = timerNode.getChildByName("TimerLabel").getComponent(cc.Label);
        this.updateTimerLabel();
    }

    updateScoreLabel() {
        if (this.scoreLabel) this.scoreLabel.string = `${this.score}`;
    }

    updateTimerLabel() {
        if (this.timerLabel) this.timerLabel.string = `${this.timer}`;
    }

    decreaseTimer() {
        if (--this.timer < 0) {
            this.endGame();
            return;
        }
        this.updateTimerLabel();
    }

    registerButtons() {
        if (!this.layout) {
            cc.warn("layout이 설정되지 않았습니다.");
            return;
        }

        const buttons = this.layout.getComponentsInChildren(cc.Button);
        buttons.forEach(btn => {
            btn.node.on("touchend", this.onButtonClicked, this);
        });
    }

    onButtonClicked(event: cc.Event) {
        if (!this.inputEnabled) return;

        const btnNode = event.target as cc.Node;
        let num = 0;

        switch (btnNode.name) {
            case "number1": num = 1; break;
            case "number2": num = 2; break;
            case "number3": num = 3; break;
            case "number4": num = 4; break;
            case "number5": num = 5; break;
            case "number6": num = 6; break;
            case "number7": num = 7; break;
            case "number8": num = 8; break;
            case "number9": num = 9; break;
            default:
                console.warn("알 수 없는 버튼 이름:", btnNode.name);
                return;
        }

        this.userInput.push(num);
        if (this.input_label) {
            this.input_label.string = this.userInput.join("");
        }

        const expected = this.isReverseMode ? [...this.numbersToShow].reverse() : this.numbersToShow;

        for (let i = 0; i < this.userInput.length; i++) {
            if (this.userInput[i] !== expected[i]) {
                this.handleWrongAnswer();
                return;
            }
        }

        if (this.userInput.length === expected.length) {
            this.handleCorrectAnswer();
        }
    }

    handleCorrectAnswer() {
        this.inputEnabled = false;
        if (this.correctSign) this.correctSign.active = true;

        this.correctCount++;
        this.score += 10;
        this.updateScoreLabel();

        this.sendAnswerResult(true);

        this.scheduleOnce(() => {
            if (this.correctSign) this.correctSign.active = false;
            this.showNewQuestion();
        }, 1.5);
    }

    handleWrongAnswer() {
        this.inputEnabled = false;
        this.sendAnswerResult(false);

        if (this.wrongSign) this.wrongSign.active = true;

        this.scheduleOnce(() => {
            if (this.wrongSign) this.wrongSign.active = false;
            this.showNewQuestion();
        }, 1.5);
    }

    sendAnswerResult(isCorrect: boolean) {
        const inputSnapshot = this.userInput.slice();
        const roomId = GameState.createdRoomId || GameState.incomingRoomId;

        window.socket.emit("game-event", {
            type: "answer-result",
            roomId,
            payload: {
                input: inputSnapshot,
                isCorrect
            }
        });

        if (isCorrect) {
            console.log("점수 emit 호출");
            window.socket.emit("game-event", {
                type: "score-update",
                roomId,
                payload: {
                    player: GameState.isHost ? "host" : "guest",
                    score: this.score
                }
            });
        }
    }

    showNewQuestion() {
    this.inputEnabled = false;
    this.userInput = [];
    if (this.input_label) this.input_label.string = "";

    this.isReverseMode = Math.random() < 0.5;

    const milestone = Math.floor(this.correctCount / 3);
    this.questionLength = 3 + milestone;
    const hideDelay = Math.max(0.8, 1.5 - milestone * 0.2);

    this.numbersToShow = [];
    const candidate = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 0; i < this.questionLength; i++) {
        const rand = candidate[Math.floor(Math.random() * candidate.length)];
        this.numbersToShow.push(rand);
    }

    if (this.random_label) {
        this.random_label.string = this.numbersToShow.join("");
        this.random_label.node.active = true;
    }

   
    if (this.reverseLabel) this.reverseLabel.node.active = false;
    if (this.verseLabel) this.verseLabel.node.active = false;

    this.scheduleOnce(() => {
        if (this.random_label) this.random_label.node.active = false;

        
        if (this.isReverseMode && this.reverseLabel) {
            this.reverseLabel.node.active = true;
        } else if (!this.isReverseMode && this.verseLabel) {
            this.verseLabel.node.active = true;
        }

        this.inputEnabled = true;
    }, hideDelay);

    const roomId = GameState.createdRoomId || GameState.incomingRoomId;
    this.lastSentQuestion = {
        numbers: this.numbersToShow,
        direction: this.isReverseMode ? "reverse" : "forward"
    };
    window.socket.emit("game-event", {
        type: "spawn-question",
        roomId,
        payload: this.lastSentQuestion
    });
}


    private endGame() {
        MultiGameFlowController.endGame({
            isGameOver: this.isGameOver,
            unscheduleAllCallbacks: () => this.unscheduleAllCallbacks(),
            score: this.score
        });
    }
}
