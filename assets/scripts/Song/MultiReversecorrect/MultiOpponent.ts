const { ccclass, property } = cc._decorator;

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

@ccclass
export default class MultiOpponent extends cc.Component {
    @property(cc.Label) questionLabel: cc.Label = null;
    @property(cc.Prefab) scoreDisplayPrefab: cc.Prefab = null;
    @property(cc.Node) correctSign: cc.Node = null;
    @property(cc.Node) wrongSign: cc.Node = null;
    @property(cc.Sprite) reverseLabel: cc.Sprite = null;
    @property(cc.Sprite) verseLabel: cc.Sprite = null;


    private scoreLabel: cc.Label = null;
    private lastQuestionNumbers: number[] = [];

    onLoad() {
        this.initScoreUI();

        window.socket.on("game-event", (data) => {
            if (!data || !data.type) return;

            switch (data.type) {
                case "spawn-question":
                    this.showQuestion(data.payload.numbers, data.payload.direction);
                    break;
                case "answer-result":
                    this.showResult(data.payload.input, data.payload.isCorrect);
                    break;
            }
        });

        cc.director.on("score-update", (payload: { player: "host" | "guest"; score: number }) => {
            console.log("[MultiOpponent] score-update 수신:", payload);
            this.updateScore(payload.score);
        });
    }

    initScoreUI() {
        const scoreNode = cc.instantiate(this.scoreDisplayPrefab);
        this.node.addChild(scoreNode);
        this.scoreLabel = scoreNode.getChildByName("ScoreLabel").getComponent(cc.Label);
        this.updateScore(0);
    }

    showQuestion(numbers: number[], direction: string) {
        this.questionLabel.string = numbers.join("");
        this.questionLabel.node.active = true;

        // 방향 이미지 초기화
        this.reverseLabel.node.active = false;
        this.verseLabel.node.active = false;

        this.scheduleOnce(() => {
            this.questionLabel.node.active = false;
            if (direction === "reverse") {
                this.reverseLabel.node.active = true;
            } 
            else {
            this.verseLabel.node.active = true;
            }
        }, 1.5);
    }

    async showResult(input: number[], isCorrect: boolean) {
        const signNode = isCorrect ? this.correctSign : this.wrongSign;
        this.questionLabel.node.active = false;

        this.questionLabel.string = input.join(" ");
        this.questionLabel.node.active = true;
        signNode.active = true;

        await delay(1500);

        signNode.active = false;

        if (this.questionLabel.string === input.join(" ")) {
            this.questionLabel.node.active = false;
        }
    }

    updateScore(score: number) {
        if (this.scoreLabel) this.scoreLabel.string = `${score}`;
    }
}
