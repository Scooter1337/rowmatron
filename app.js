/*
 * Big thanks to Tijmen van Gulik, even though he seems to have abandoned the ErgometerJS project (for now)
 * His api enabled me to create this program in 5 hours, instead of figuring out days of hexadecimal/csafe code
 *
 *
 */


let RowMatronApp = /** @class */ (function () {
    function RowMatronApp() {
        this.initialize();
        $("#holder").hide();
        $("#Check1").hide();
        $("#NextPlayer").hide();
        //$("#scoreboard").hide();
    }
    Object.defineProperty(RowMatronApp.prototype, "performanceMonitor", {
        get: function () {
            return this._performanceMonitor;
        },
        enumerable: true,
        configurable: true
    });

    RowMatronApp.prototype.setCustomDistance = function (distance) {
        //This is the byte order sent in PyRow, copied that because simply
        //setting the HorizontalDistance did not work
        this.performanceMonitor.newCsafeBuffer()
            .addRawCommand({
                waitForResponse:false,
                command : 129//csafe.SHORT_CTRL_CMDS.RESET_CMD,//129
            }).setDistance({value: distance, unit: 36})
            .setProgram({value: 0})
            .addRawCommand({
                waitForResponse: false,
                command: 133,
            })
            .send().catch(e=> console.error(e));


    }

    RowMatronApp.prototype.updateScoreboardArrayAndObject = function () {
        const player = this._players[this.currentPlayerData.id];
        const time = this.currentPlayerBestTime;
        this._scoreBoard.push({player: player, time: time});
        this._scoreBoard = this._scoreBoard.sort((a,b) => {
            if(typeof a.time === 'number' && typeof b.time == 'number') {
                return a.time - b.time;
            }
            return 0;
        })
        //console.warn(this._scoreBoard);
        const scoreboard = this._scoreBoard;
        let $ul = $('#scoreboard-object');
        $ul.empty();
        for (let i = 0; i < scoreboard.length; i++) {
            let thisplayer = scoreboard[i].player;
            let thistime = this.timeToSeconds(scoreboard[i].time);
            let $li = $('<li>').text(thisplayer + ' - ' + thistime+'s');
            $ul.append($li);
        }
    }

    RowMatronApp.prototype.timeToSeconds = function (time) {
        //console.error('Berekend:' + Math.floor(time / 100) /10);
        return Math.floor(time / 100) /10;
    }


    RowMatronApp.prototype.showInfo = function (info) {
        $("#info").text(info);
    };
    RowMatronApp.prototype.updateDataDisplay = function (data, general = false) {
        if(general) {
            let distance = data['workoutDuration'] - data['distance'];
            let time = this.timeToSeconds(data['elapsedTime']);
            if(data['workoutState'] === 0) {
                time = 0; //time may be above 0, even though the workout is stopped, this sets it to 0.
            }
            distance = Math.max(0, distance); //no negativity allowed...
            $("#time").text(time);
            $("#distance").text(Math.round(distance));
            const percentage = Math.round((data['distance']/data['workoutDuration'])*100);
            //I'd rather replace this with a div with z-index -10000, so we can add transitions to make it less choppy
            //Not a priority, with 10Hz its pretty smooth already.
            updateBackground(percentage);

            if(this._scoreBoard.length > 0 && this.currentPlayerData.id > 0 && this.showGhost) { //ghost
                const bestTime = this._scoreBoard[0].time;
                const width = Math.min(data['elapsedTime'] / bestTime, 1) * $(document).width();
                $("#ghost-bar").width(width);
            }
        }
    };

    RowMatronApp.prototype.setCurrentPlayerDisplay = function () {
        const currPlayer =  this._players[this.currentPlayerData.id];
        $("#currentPlayer").text("It's " + currPlayer + "'s turn!");
    }

    RowMatronApp.prototype.getPlayersFromTextArea = function () {
        let text = $("#textarea").val();
        if(text === 'Players,Seperated,By,Comma') {
            text = ''; //No names entered or default preset untouched: singleplayer?
        }
        text = text.replaceAll(' ,', ',');
        text = text.replaceAll(', ', ',');
        let players = text.split(',');
        players = players.filter((a) => {
            return a.replaceAll(' ', '').length > 0;
        })

        //Some randomization algorithm, forgot the name
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = players[i];
            players[i] = players[j];
            players[j] = temp;
        }
        this._players = players.length > 0 ? players : ['anonymous'];
        setStorage('players', $("#textarea").val());
    }

    /*RowMatronApp.prototype.changePollingRateToFastest = function () {

            let newBuffer = this.performanceMonitor.newCsafeBuffer();
            newBuffer.addRawCommand({
                command: 118,
                detailCommand: 51,
                data: [3],
                waitForResponse: false
            }).send().then(()=>console.error('Changed polling rate')).catch(e => console.error(e));
    }*/

    RowMatronApp.prototype.initialize = function () {
        const _this = this;
        this._performanceMonitor = new ergometer.PerformanceMonitorBle();
        this._performanceMonitor.sampleRate = 3;
        this._players = [];
        this._scoreBoard = [];// [{player: 'Dylan', time: 18000, timestamps: [{time: 100, distance: 1},]}];
        this.currentPlayerData = {id: 0, bestTime: 0, pace: 0, timestamps: []};

        this.showGhost = false;
        //this.performanceMonitor.logLevel=ergometer.LogLevel.trace;
        this.performanceMonitor.logEvent.sub(this, this.onLog);
        this.performanceMonitor.connectionStateChangedEvent.sub(this, this.onConnectionStateChanged);
        //connect to the rowing information Observables
        this.performanceMonitor.rowingGeneralStatusEvent.sub(this, this.onRowingGeneralStatus);
        this.performanceMonitor.rowingAdditionalStatus1Event.sub(this, this.onRowingAdditionalStatus1);
        this.performanceMonitor.rowingAdditionalStatus2Event.sub(this, this.onRowingAdditionalStatus2);
        this.performanceMonitor.rowingStrokeDataEvent.sub(this, this.onRowingStrokeData);
        this.performanceMonitor.rowingAdditionalStrokeDataEvent.sub(this, this.onRowingAdditionalStrokeData);
        this.performanceMonitor.rowingSplitIntervalDataEvent.sub(this, this.onRowingSplitIntervalData);
        this.performanceMonitor.rowingAdditionalSplitIntervalDataEvent.sub(this, this.onRowingAdditionalSplitIntervalData);
        this.performanceMonitor.workoutSummaryDataEvent.sub(this, this.onWorkoutSummaryData);
        this.performanceMonitor.additionalWorkoutSummaryDataEvent.sub(this, this.onAdditionalWorkoutSummaryData);
        //this.performanceMonitor.heartRateBeltInformationEvent.sub(this, this.onHeartRateBeltInformation);
        this.performanceMonitor.additionalWorkoutSummaryData2Event.sub(this, this.onAdditionalWorkoutSummaryData2);
        this.performanceMonitor.powerCurveEvent.sub(this, this.onPowerCurve);
        $("#StartScan").click(function () {
            _this.getPlayersFromTextArea();
            _this.startScan();
        });
        if (!ergometer.ble.hasWebBlueTooth()) {
            console.error("WEB BLE NOT AVAILABLE");
        }
    };

    RowMatronApp.prototype.NextPlayer = function () {
        this.currentPlayerData.id++;
        this.currentPlayerData.bestTime = 0;
        this.currentPlayerData.pace = 0;
        this.currentPlayerData.timestamps = [];
        this.setCurrentPlayerDisplay();
        this.resetPM();
        $("#NextPlayer").hide();
        this.showGhost = true;
    }
    RowMatronApp.prototype.resetPM = function () {
        let newBuffer = this.performanceMonitor.newCsafeBuffer();
        newBuffer.addRawCommand({
            command: 118,
            detailCommand: 19,
            data: [1, 2],
            waitForResponse: false
        }).send().then(() => this.setCustomDistance(100)); //F1 76 04 13 02 01 02 62 F2
    }
    RowMatronApp.prototype.onLog = function (info, logLevel) {
        this.updateDataDisplay(info);
        console.debug(info);
    };
    RowMatronApp.prototype.onRowingGeneralStatus = function (data) {
        this.updateDataDisplay(data, true); // + JSON.stringify
        //console.log('RowingGeneralStatus: ');
        //console.log(data);
        this.currentPlayerBestTime = data['elapsedTime'];

    };
    RowMatronApp.prototype.onRowingAdditionalStatus1 = function (data) {
        this.updateDataDisplay('RowingAdditionalStatus1: ' + JSON.stringify(data));
        //console.log('RowingAdditionalStatus1: ');
        //console.log(data);
    };
    RowMatronApp.prototype.onRowingAdditionalStatus2 = function (data) {
        this.updateDataDisplay('RowingAdditionalStatus2:' + JSON.stringify(data));
        //console.log('RowingAdditionalStatus2: ');
        //console.log(data);
    };
    RowMatronApp.prototype.onRowingStrokeData = function (data) {
        this.updateDataDisplay('RowingStrokeData:' + JSON.stringify(data));
        //console.log('RowingStrokeData: ');
        //console.log(data);
    };
    RowMatronApp.prototype.onRowingAdditionalStrokeData = function (data) {
        this.updateDataDisplay('RowingAdditionalStrokeData:' + JSON.stringify(data));
        //console.log('RowingAdditionalStrokeData: ');
        //console.log(data);
        this.currentPace = data['projectedWorkTime'];
        $("#projected-time").text(this.timeToSeconds(this.currentPace) + 's');
        let color;
        if(this.currentPace > 20000) {
            color = 'red';
        } else if (this.currentPace > 18000) { //maybe make these a setting?
            color = 'orange';
        } else {
            color = 'green';
        }
        document.getElementById('projected-time-box').style.backgroundColor = color;
    };
    RowMatronApp.prototype.onRowingSplitIntervalData = function (data) {
        this.updateDataDisplay('RowingSplitIntervalData:' + JSON.stringify(data));
        //console.log('RowingSplitIntervalData: ');
        //console.log(data);
    };
    RowMatronApp.prototype.onRowingAdditionalSplitIntervalData = function (data) {
        this.updateDataDisplay('RowingAdditionalSplitIntervalData:' + JSON.stringify(data));
        //console.log('RowingAdditionalSplitIntervalData: ');
        //console.log(data);
    };
    RowMatronApp.prototype.onWorkoutSummaryData = function (data) {
        this.updateDataDisplay('WorkoutSummaryData' + JSON.stringify(data));
        //console.log('WorkoutSummaryData: ');
        //console.log(data);
        if(data['distance'] > 95) {
            this.updateScoreboardArrayAndObject();
            $("#NextPlayer").show();
            $("#ghost-bar").width(0);
            this.showGhost = false;
        }

    };
    RowMatronApp.prototype.onAdditionalWorkoutSummaryData = function (data) {
        this.updateDataDisplay('AdditionalWorkoutSummaryData' + JSON.stringify(data));
        //console.log('AdditionalWorkoutSummaryData: ');
        //console.log(data);
    };
    RowMatronApp.prototype.onAdditionalWorkoutSummaryData2 = function (data) {
        this.updateDataDisplay('AdditionalWorkoutSummaryData2:' + JSON.stringify(data));
        //console.log('AdditionalWorkoutSummaryData2: ');
        //console.log(data);
    };
    RowMatronApp.prototype.onHeartRateBeltInformation = function (data) {
        this.updateDataDisplay('HeartRateBeltInformation:' + JSON.stringify(data));
        //console.log('HeartRateBeltInformation: ');
        //console.log(data);
    };
    RowMatronApp.prototype.onConnectionStateChanged = function (oldState, newState) {
        var _this = this;
        if (newState === ergometer.MonitorConnectionState.readyForCommunication) {
            this.performanceMonitor.sampleRate=3; //MORE HERTZ
            this.updateDataDisplay(JSON.stringify(this._performanceMonitor.deviceInfo));
            //set some onClick events, love you jquery <3
            $("#Check1").click(() => {
                this.resetPM();
            });
            $("#NextPlayer").click(() => {
                this.NextPlayer();
            })
            this.performanceMonitor.newCsafeBuffer()
                .getStrokeState({
                onDataReceived: function (strokeState) {
                    _this.updateDataDisplay("stroke state: " + strokeState);
                }
            })
                .getVersion({
                onDataReceived: function (version) {
                    _this.updateDataDisplay("Version hardware " + version.HardwareVersion + " software:" + version.FirmwareVersion);
                    console.log("Version hardware " + version.HardwareVersion + " software:" + version.FirmwareVersion);
                }
            })
                .send().catch(e => console.log(e))
                .then(() => {
                    console.log("Set Program succesfully!");
                    $("#StartScan").hide();
                    $("textarea").hide();
                    $(".hide-on-connect").hide();
                    $("#holder").show();
                    $("#Check1").show();
            });
            this.setCurrentPlayerDisplay(); // cant use 'this' in a .then() so... ; doesnt really matter.
            this.setCustomDistance(100);
        }
    };
    RowMatronApp.prototype.onPowerCurve = function (curve) {
        this.updateDataDisplay("Curve in gui: " + JSON.stringify(curve));
    };
    RowMatronApp.prototype.startScan = function () {
        this.performanceMonitor.startScan(function (device) {
            // we can't control connection via code for security reasons
            return true;
        }).then(r => console.log(r && 'Device connected succesfully!')).catch(e => console.log('Error during connection setup: ' + e));
    };
    RowMatronApp.prototype.pageLoaded = function () {
        const localStorageText = getStorage('players'); // get persistent storage
        if(localStorageText.length > 0) { //does persistent storage contain info? then set the textarea to the value
            $("#textarea").val(localStorageText);
        }
    };
    return RowMatronApp;
}());

let App = /** @class */ (function () {
    function App() {
        const _this = this;
        $().ready(function () {
            _this._rowMatronApp = new RowMatronApp();
            _this.rowMatronApp.pageLoaded();
        });
    }
    Object.defineProperty(App.prototype, "rowMatronApp", {
        get: function () {
            return this._rowMatronApp;
        },
        enumerable: true,
        configurable: true
    });
    return App;
}());
let app = new App(); //NOT UNUSED, BREAKS APP IF REMOVED WEBSTORM!

function getStorage(key) {
    return localStorage.getItem(key);
}

function setStorage(key, data) {
    localStorage.setItem(key, data);
    return true;
}

function hideOnConnected() {

}

function showOnConnected() {

}

function hideOnStart() {

}

function updateBackground(percentage) {
    document.body.style.backgroundImage = "linear-gradient(90deg, blue " + percentage + "%, transparent 0%)";

}
