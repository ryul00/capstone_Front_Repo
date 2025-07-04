import GameState from "../CommonUI/GameState";

const { ccclass, property } = cc._decorator;

@ccclass
export default class MultiGameListController extends cc.Component {
    @property(cc.Node) gameCardContainer: cc.Node = null;
    @property(cc.Prefab) gameCardPrefab: cc.Prefab = null;
    @property(cc.Button) selectButton: cc.Button = null;
    @property(cc.Node) leftArrow: cc.Node = null;
    @property(cc.Node) rightArrow: cc.Node = null;
    @property(cc.Button) BackButton: cc.Button = null;

    private currentIndex: number = 0;
    private cards: cc.Node[] = [];
    private selectedScene: string = null;
    private _gameEventHandler: any = null; // 리스너 참조 변수 선언

    private pollingTimer: number = null;



    private gameList = [
        { title: '두더지 게임', thumbnail: 'mole_thumb', scene: 'MultiMoleGameScene'
            , desc: '나쁜 두더지를 최대한 많이 잡으세요!\n 착한 두더지를 잡으면 점수가 떨어지니 조심하세요!' },
        // { title: '블록 개수 세기', thumbnail: 'block_thumb', scene: 'MultiBlockCountGameScene'
        //     , desc: '떨어지는 블록의 개수를 맞추세요!\n 오답을 고르면 점수가 떨어지니\n 조심하세요!'  },
        { title: '기억력 게임', thumbnail: 'remember_thumb', scene: 'MultiRememberGameScene'
            , desc: '깜빡이는 잎의 순서를 잘 기억해서\n  그대로 눌러보세요!\n 하지만 방심하면 반전에 놀랄지도 몰라요!'},
        { title: '숫자 뒤집어 맞추기', thumbnail: 'reverse_thumb', scene: 'Reversecorrect_Multiscene'
            , desc: '잠깐 공개된 숫자를 기억하고 맞혀보세요!\n가끔씩은 역방향으로 맞춰보세요! '  },
        // { title: '집중력 게임', thumbnail: 'concetration_thumb', scene: 'Rottenacorn_Multiscene' 
        //     , desc: '잠깐 내부가 보였다 사라지는 도토리들! \n 벌레 먹은 도토리를 기억하고,\n정확히 골라내세요.' },
        // { title: '미로 게임', thumbnail: 'maze_thumb', scene: 'Maze_MultiScene' 
        //     , desc: '미로를 뚫고 동물들이 음식을 찾는 걸 \n 도와주세요!  기회는 단 한번 뿐이에요!' },
    ];

    onLoad() {
        cc.debug.setDisplayStats(false);
        this.selectButton.interactable = false;

        cc.log("MultiGameListController onLoad 실행됨");
        cc.log("GameState.isHost =", GameState.isHost);

        this.loadGameCards();

        this.registerArrowEvents(this.leftArrow, this.showPrevCard.bind(this));
        this.registerArrowEvents(this.rightArrow, this.showNextCard.bind(this));
        this.registerButtonEvents(this.selectButton.node, this.onSelectButtonClick.bind(this));
        this.registerButtonEvents(this.BackButton.node, this.onClickMain.bind(this));

        // 게스트는 UI 제어 비활성화
        if (!GameState.isHost) {
            this.selectButton.node.active = false;
        }



        if (!cc.sys.isNative && window.socket) {
            const roomId = GameState.createdRoomId || GameState.incomingRoomId;

            if (!window.socket.connected) {
                console.warn("소켓이 끊겨 있음. 재연결 시도 중");
                window.socket.connect();
            }

            if (roomId) {
                cc.log("join-room 재요청:", roomId);
                window.socket.emit("join-room", roomId);
            }

            // 기존 리스너를 오프할 때 핸들러 참조로 해제
            this._gameEventHandler = (message: any) => {
                cc.log("game-event 수신:", message);

                switch (message?.type) {
                    case "move-scene":
                        const sceneName = message.payload?.sceneName;
                        if (sceneName) {
                            cc.log("씬 이동 시도:", sceneName);
                            cc.director.loadScene(sceneName);
                        } else {
                            cc.warn("sceneName 누락됨:", message);
                        }
                        break;

                    case "host-left":
                        cc.warn("호스트가 방을 나갔습니다. 메인 화면으로 이동합니다.");
                        // pollingTimer 해제 (있을 때만)
                        if (this.pollingTimer) {
                            clearInterval(this.pollingTimer);
                            this.pollingTimer = null;
                        }
                        GameState.resetMultiplay();
                        cc.sys.localStorage.removeItem("isHost");
                        cc.director.loadScene("MainScene");
                        break;

                    default:
                        cc.warn("알 수 없는 game-event 타입 또는 잘못된 구조:", message);
                }
            };

            window.socket.on("game-event", this._gameEventHandler);

            // MultiConnect -> MultiGameList로 이동 후 소켓연결이 끊겼으므로 재연결 해줘야 함
            window.socket.on("connect", () => {
                cc.log("소켓 재연결됨. join-room 재전송");
                if (roomId) {
                    window.socket.emit("join-room", roomId);
                }
            });
        }

    }

    onDestroy() {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
        if (!cc.sys.isNative && window.socket && this._gameEventHandler) {
            window.socket.off("game-event", this._gameEventHandler);
        }
    }

    registerButtonEvents(node: cc.Node, callback: () => void) {
        node.off(cc.Node.EventType.TOUCH_END);
        node.on(cc.Node.EventType.TOUCH_END, callback);
    }

    registerArrowEvents(node: cc.Node, callback: () => void) {
        node.off(cc.Node.EventType.TOUCH_END);
        node.on(cc.Node.EventType.TOUCH_END, callback);
    }

    loadGameCards() {
        this.gameList.forEach((game, index) => {
            cc.log("카드 생성:", index, game.title);
            const card = cc.instantiate(this.gameCardPrefab);

            const titleNode = card.getChildByName("GameTitleBox")?.getChildByName("GameTitle");
            if (titleNode && titleNode.getComponent(cc.Label)) {
                titleNode.getComponent(cc.Label).string = game.title;
            }
            const descNode = card.getChildByName("GameDesc");
            if (descNode && descNode.getComponent(cc.Label)) {
                descNode.getComponent(cc.Label).string = game.desc;
            }
            const thumbnailNode = card.getChildByName("GameThumbnail");
            if (thumbnailNode && thumbnailNode.getComponent(cc.Sprite)) {
                cc.resources.load(`Images/Common/thumbnails/${game.thumbnail}`, cc.SpriteFrame, (err, spriteFrame) => {
                    if (!err && spriteFrame) {
                        thumbnailNode.getComponent(cc.Sprite).spriteFrame = spriteFrame;
                    }
                });
            }

            card.active = false;
            this.cards.push(card);
            this.gameCardContainer.addChild(card);
        });

        this.showCardAtIndex(0);
    }

    showCardAtIndex(index: number) {
        cc.log(`showCardAtIndex 호출: index = ${index}, cards.length = ${this.cards.length}`);
        this.cards.forEach((card, i) => {
            card.active = i === index;
        });
        this.currentIndex = index;
        this.selectScene(this.gameList[index].scene, this.cards[index]);
    }

    showNextCard() {
        const nextIndex = (this.currentIndex + 1) % this.cards.length;
        this.showCardAtIndex(nextIndex);
    }

    showPrevCard() {
        const prevIndex = (this.currentIndex - 1 + this.cards.length) % this.cards.length;
        this.showCardAtIndex(prevIndex);
    }

    private selectScene(sceneName: string, selectedCard: cc.Node) {
        this.selectedScene = sceneName;
        this.gameCardContainer.children.forEach(card => {
            card.scale = card === selectedCard ? 1.1 : 1;
            card.opacity = card === selectedCard ? 255 : 180;
        });
        this.selectButton.interactable = true;
    }

    onSelectButtonClick() {
        if (!this.selectedScene) return;

        const roomId = GameState.createdRoomId;
        console.log("[onSelectButtonClick] move-scene emit 시도:", this.selectedScene, GameState.isHost, roomId);

        if (GameState.isHost && roomId && window.socket) {
            window.socket.emit("game-event", {
                type: "move-scene",
                payload: { sceneName: this.selectedScene },
                roomId,
            });
        }

        console.log("window.socket 상태:", window.socket && window.socket.connected);
    }
    onClickMain() {
        // pollingTimer 해제 (있을 때만)
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }

        // 1. roomId, playerId는 emit 전에 읽어둬야 함
        const roomId = GameState.createdRoomId || GameState.incomingRoomId;
        const playerId = GameState.browserId;
        cc.log("[leave-room emit]", { roomId, playerId });
        if (window.socket && roomId && playerId) {
            window.socket.emit("leave-room", { roomId, playerId });
        }

        // 2. 상태/스토리지 초기화
        GameState.resetMultiplay();
        cc.sys.localStorage.removeItem("isHost");

        // 3. 씬 이동
        cc.director.loadScene("MainScene");
    }

} 