// Debug configuration
var DEBUG = true;

function debugLog(...args) {
    if (DEBUG) {
        console.log('[DEBUG]', ...args);
    }
}

// Resource definitions
var res = {
    background_png: "resource/background.png",
    whale_png: "resource/whale.png",
    btn_bg: "resource/btn_bg.png"
};

// Global resources array
var g_resources = [];
for (var i in res) {
    g_resources.push(res[i]);
}

// High scores storage
var HighScores = {
    KEY: "whack_a_whale_high_scores",
    MAX_SCORES: 10,
    
    getScores: function() {
        var scores = localStorage.getItem(this.KEY);
        return scores ? JSON.parse(scores) : [];
    },
    
    saveScore: function(score) {
        var scores = this.getScores();
        scores.push({
            score: score,
            date: new Date().toISOString()
        });
        
        // Sort by score (highest first)
        scores.sort(function(a, b) {
            return b.score - a.score;
        });
        
        // Keep only top scores
        if (scores.length > this.MAX_SCORES) {
            scores = scores.slice(0, this.MAX_SCORES);
        }
        
        localStorage.setItem(this.KEY, JSON.stringify(scores));
        return scores;
    },
    
    isHighScore: function(score) {
        var scores = this.getScores();
        return scores.length < this.MAX_SCORES || score > (scores[scores.length - 1]?.score || 0);
    }
};

// Welcome Scene
var WelcomeScene = cc.Scene.extend({
    onEnter: function() {
        this._super();
        var size = cc.director.getWinSize();
        debugLog('Window Size:', size);
        
        // Background
        var background = new cc.Sprite(res.background_png);
        debugLog('Background original size:', background.width, 'x', background.height);
        
        background.setPosition(size.width / 2, size.height / 2);
        var scaleX = size.width / background.width;
        var scaleY = size.height / background.height;
        debugLog('Background scale factors:', scaleX, scaleY);
        
        background.setScale(scaleX, scaleY);
        debugLog('Background final position:', background.getPosition());
        debugLog('Background final size:', background.width * scaleX, 'x', background.height * scaleY);
        
        this.addChild(background);
        
        // Title
        var title = new cc.LabelTTF("Whack-a-Whale", "Arial", 60);
        title.setPosition(size.width / 2, size.height * 0.7);
        title.setColor(cc.color(255, 255, 255));
        this.addChild(title);
        
        // Instructions
        var instructions = new cc.LabelTTF(
            "Click on the whale to earn 10 points\n" +
            "Missing costs 20 points\n" +
            "You have 60 seconds to play",
            "Arial", 24
        );
        instructions.setPosition(size.width / 2, size.height * 0.5);
        instructions.setColor(cc.color(255, 255, 255));
        this.addChild(instructions);
        
        // Create "Start Game" button using ccui.Button with proper background
        var startButton = new ccui.Button(res.btn_bg, res.btn_bg, res.btn_bg, ccui.Widget.LOCAL_TEXTURE);
        startButton.setTouchEnabled(true);
        startButton.setScale9Enabled(true);
        startButton.setCapInsets(cc.rect(1, 1, 1, 1));
        startButton.setContentSize(cc.size(200, 50));
        startButton.setPosition(size.width / 2, size.height * 0.3);
        // startButton.setColor(cc.color(0, 100, 200));
        startButton.setOpacity(180);
        startButton.addTouchEventListener(function(sender, type) {
            if (type === ccui.Widget.TOUCH_ENDED) {
                cc.director.runScene(new GameScene());
            }
        }, this);
        
        // Add border to button
        // var startBg = new cc.DrawNode();
        // startBg.drawRect(
        //     cc.p(-100, -25),
        //     cc.p(100, 25),
        //     cc.color(0, 0, 0, 0),  // Transparent fill
        //     2,
        //     cc.color(0, 150, 250)  // Border color
        // );
        // startButton.addChild(startBg, -1);
        
        // Add text label on top of button
        var startLabel = new cc.LabelTTF("Start Game", "Arial", 36);
        startLabel.setColor(cc.color(255, 255, 255));
        startLabel.setPosition(startButton.width/2, startButton.height/2);
        startButton.addChild(startLabel, 10);
        
        this.addChild(startButton);
        
        // Create "High Scores" button using ccui.Button with proper background
        var scoresButton = new ccui.Button(res.btn_bg, res.btn_bg, res.btn_bg, ccui.Widget.LOCAL_TEXTURE);
        scoresButton.setTouchEnabled(true);
        scoresButton.setScale9Enabled(true);
        scoresButton.setCapInsets(cc.rect(1, 1, 1, 1));
        scoresButton.setContentSize(cc.size(200, 50));
        scoresButton.setPosition(size.width / 2, size.height * 0.2);
        // scoresButton.setColor(cc.color(0, 100, 200));
        scoresButton.setOpacity(180);
        scoresButton.addTouchEventListener(function(sender, type) {
            if (type === ccui.Widget.TOUCH_ENDED) {
                cc.director.runScene(new HighScoreScene());
            }
        }, this);
        
        // Add border to button
        var scoresBg = new cc.DrawNode();
        scoresBg.drawRect(
            cc.p(-80, -20),
            cc.p(80, 20),
            cc.color(0, 0, 0, 0),  // Transparent fill
            2,
            cc.color(0, 150, 250)  // Border color
        );
        // scoresButton.addChild(scoresBg, -1);
        
        // Add text label on top of button
        var scoresLabel = new cc.LabelTTF("High Scores", "Arial", 24);
        scoresLabel.setColor(cc.color(255, 255, 255));
        scoresLabel.setPosition(scoresButton.width/2, scoresButton.height/2);
        scoresButton.addChild(scoresLabel, 10);
        
        this.addChild(scoresButton);
    }
});

// Main Game Scene
var GameScene = cc.Scene.extend({
    score: 0,
    timeRemaining: 60,
    isGameOver: false,
    whale: null,
    scoreLabel: null,
    timeLabel: null,
    whaleAppearInterval: null,
    
    onEnter: function() {
        this._super();
        var size = cc.director.getWinSize();
        
        // Set cursor to hammer
        document.body.classList.add("hammer-cursor");
        
        // Background
        var background = new cc.Sprite(res.background_png);
        background.setPosition(size.width / 2, size.height / 2);
        background.setScale(
            size.width / background.width,
            size.height / background.height
        );
        this.addChild(background);
        
        // Score display
        this.scoreLabel = new cc.LabelTTF("Score: 0", "Arial", 24);
        this.scoreLabel.setPosition(size.width * 0.2, size.height - 30);
        this.scoreLabel.setColor(cc.color(255, 255, 255));
        this.addChild(this.scoreLabel);
        
        // Time display
        this.timeLabel = new cc.LabelTTF("Time: 60", "Arial", 24);
        this.timeLabel.setPosition(size.width * 0.8, size.height - 30);
        this.timeLabel.setColor(cc.color(255, 255, 255));
        this.addChild(this.timeLabel);
        
        // Create whale (initially hidden)
        this.whale = new cc.Sprite(res.whale_png);
        this.whale.setVisible(false);
        this.addChild(this.whale);
        
        // Add click event listener to the entire scene
        cc.eventManager.addListener({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            swallowTouches: true,
            onTouchBegan: this.onTouch.bind(this)
        }, this);
        
        // Schedule game logic
        this.schedule(this.gameLoop, 1);
        
        // Start whale appearances
        this.scheduleWhaleAppearance();
    },
    
    onExit: function() {
        // Reset cursor
        document.body.classList.remove("hammer-cursor");
        
        // Clear schedules
        this.unschedule(this.gameLoop);
        if (this.whaleAppearInterval) {
            clearInterval(this.whaleAppearInterval);
        }
        
        this._super();
    },
    
    gameLoop: function(dt) {
        if (this.isGameOver) return;
        
        // Update time
        this.timeRemaining--;
        this.timeLabel.setString("Time: " + this.timeRemaining);
        
        // Check if game is over
        if (this.timeRemaining <= 0) {
            this.endGame();
        }
    },
    
    scheduleWhaleAppearance: function() {
        // Make whale appear every 2-3 seconds
        var self = this;
        
        function makeWhaleAppear() {
            if (self.isGameOver) return;
            
            var size = cc.director.getWinSize();
            
            // Hide whale if it's visible
            self.whale.setVisible(false);
            
            // Well-defined positions (6 holes in a 3x2 grid)
            var positions = [
                // Bottom row (from left to right)
                {x: size.width * 0.15, y: size.height * 0.15},  // Bottom left
                {x: size.width * 0.5, y: size.height * 0.15},   // Bottom middle
                {x: size.width * 0.85, y: size.height * 0.15},  // Bottom right
                
                // Top row (from left to right)
                {x: size.width * 0.15, y: size.height * 0.35},  // Top left
                {x: size.width * 0.5, y: size.height * 0.35},   // Top middle
                {x: size.width * 0.85, y: size.height * 0.35}   // Top right
            ];
            
            // Select a random position from the defined positions
            var randomPosition = positions[Math.floor(Math.random() * positions.length)];
            
            // Set whale position to the selected hole
            self.whale.setPosition(randomPosition.x, randomPosition.y);
            
            // Show whale
            self.whale.setVisible(true);
            self.whale.setScale(0.2);
            
            // Hide whale after 2-3 seconds if not clicked
            setTimeout(function() {
                if (self.whale.isVisible() && !self.isGameOver) {
                    self.whale.setVisible(false);
                }
            }, 2000 + Math.random() * 1000);
        }
        
        // Initial appearance
        makeWhaleAppear();
        
        // Schedule regular appearances
        this.whaleAppearInterval = setInterval(makeWhaleAppear, 3000 + Math.random() * 1000);
    },   
    onTouch: function(touch, event) {
        if (this.isGameOver) return false;
        
        var location = touch.getLocation();
        
        // Check if whale was hit
        if (this.whale.isVisible()) {
            var whaleRect = this.whale.getBoundingBox();
            
            if (cc.rectContainsPoint(whaleRect, location)) {
                // Hit the whale
                this.score += 10;
                this.scoreLabel.setString("Score: " + this.score);
                
                // Hide whale
                this.whale.setVisible(false);
                
                return true;
            }
        }
        
        // Missed - deduct points
        this.score = Math.max(0, this.score - 20);  
        this.scoreLabel.setString("Score: " + this.score);
        
        return true;
    },
    
    endGame: function() {
        this.isGameOver = true;
        
        // Save score
        HighScores.saveScore(this.score);
        
        // Show game over scene
        cc.director.runScene(new GameOverScene(this.score));
    }
});

// Game Over Scene
var GameOverScene = cc.Scene.extend({
    ctor: function(finalScore) {
        this._super();
        this.finalScore = finalScore || 0;
    },
    
    onEnter: function() {
        this._super();
        var size = cc.director.getWinSize();
        
        // Background
        var background = new cc.Sprite(res.background_png);
        background.setPosition(size.width / 2, size.height / 2);
        background.setScale(
            size.width / background.width,
            size.height / background.height
        );
        this.addChild(background);
        
        // Game Over text
        var gameOverLabel = new cc.LabelTTF("Game Over", "Arial", 60);
        gameOverLabel.setPosition(size.width / 2, size.height * 0.7);
        gameOverLabel.setColor(cc.color(255, 255, 255));
        this.addChild(gameOverLabel);
        
        // Final score
        var scoreLabel = new cc.LabelTTF("Your Score: " + this.finalScore, "Arial", 36);
        scoreLabel.setPosition(size.width / 2, size.height * 0.5);
        scoreLabel.setColor(cc.color(255, 255, 255));
        this.addChild(scoreLabel);
        
        // High score message if applicable
        if (HighScores.isHighScore(this.finalScore)) {
            var highScoreLabel = new cc.LabelTTF("New High Score!", "Arial", 30);
            highScoreLabel.setPosition(size.width / 2, size.height * 0.6);
            highScoreLabel.setColor(cc.color(255, 255, 0));
            this.addChild(highScoreLabel);
        }
        
        // Create "Play Again" button using ccui.Button with proper background
        var playAgainButton = new ccui.Button(res.btn_bg, res.btn_bg, res.btn_bg, ccui.Widget.LOCAL_TEXTURE);
        playAgainButton.setTouchEnabled(true);
        playAgainButton.setScale9Enabled(true);
        playAgainButton.setCapInsets(cc.rect(1, 1, 1, 1));
        playAgainButton.setContentSize(cc.size(200, 50));
        playAgainButton.setPosition(size.width / 2, size.height * 0.3);
        // playAgainButton.setColor(cc.color(0, 100, 200));
        playAgainButton.setOpacity(180);
        playAgainButton.addTouchEventListener(function(sender, type) {
            if (type === ccui.Widget.TOUCH_ENDED) {
                cc.director.runScene(new GameScene());
            }
        }, this);
        
        // Add border to button
        var playAgainBg = new cc.DrawNode();
        playAgainBg.drawRect(
            cc.p(-100, -25),
            cc.p(100, 25),
            cc.color(0, 0, 0, 0),  // Transparent fill
            2,
            cc.color(0, 150, 250)  // Border color
        );
        // playAgainButton.addChild(playAgainBg, -1);
        
        // Add text label on top of button
        var playAgainLabel = new cc.LabelTTF("Play Again", "Arial", 36);
        playAgainLabel.setColor(cc.color(255, 255, 255));
        playAgainLabel.setPosition(playAgainButton.width/2, playAgainButton.height/2);
        playAgainButton.addChild(playAgainLabel, 10);
        
        this.addChild(playAgainButton);
        
        // Create "Main Menu" button using ccui.Button with proper background
        var menuButton = new ccui.Button(res.btn_bg, res.btn_bg, res.btn_bg, ccui.Widget.LOCAL_TEXTURE);
        menuButton.setTouchEnabled(true);
        menuButton.setScale9Enabled(true);
        menuButton.setCapInsets(cc.rect(1, 1, 1, 1));
        menuButton.setContentSize(cc.size(160, 40));
        menuButton.setPosition(size.width / 2, size.height * 0.2);
        // menuButton.setColor(cc.color(0, 100, 200));
        menuButton.setOpacity(180);
        menuButton.addTouchEventListener(function(sender, type) {
            if (type === ccui.Widget.TOUCH_ENDED) {
                cc.director.runScene(new WelcomeScene());
            }
        }, this);
        
        // Add border to button
        var menuBg = new cc.DrawNode();
        menuBg.drawRect(
            cc.p(-80, -20),
            cc.p(80, 20),
            cc.color(0, 0, 0, 0),  // Transparent fill
            2,
            cc.color(0, 150, 250)  // Border color
        );
        menuButton.addChild(menuBg, -1);
        
        // Add text label on top of button
        var menuLabel = new cc.LabelTTF("Main Menu", "Arial", 24);
        menuLabel.setColor(cc.color(255, 255, 255));
        menuLabel.setPosition(menuButton.width/2, menuButton.height/2);
        menuButton.addChild(menuLabel, 10);
        
        this.addChild(menuButton);
    }
});

// High Score Scene
var HighScoreScene = cc.Scene.extend({
    onEnter: function() {
        this._super();
        var size = cc.director.getWinSize();
        
        // Background
        var background = new cc.Sprite(res.background_png);
        background.setPosition(size.width / 2, size.height / 2);
        background.setScale(
            size.width / background.width,
            size.height / background.height
        );
        this.addChild(background);
        
        // Title
        var title = new cc.LabelTTF("High Scores", "Arial", 48);
        title.setPosition(size.width / 2, size.height * 0.85);
        title.setColor(cc.color(255, 255, 255));
        this.addChild(title);
        
        // Get scores
        var scores = HighScores.getScores();
        
        // Display scores
        var yPos = size.height * 0.75;
        var yStep = 40;
        
        if (scores.length === 0) {
            var noScoresLabel = new cc.LabelTTF("No scores yet. Play the game!", "Arial", 24);
            noScoresLabel.setPosition(size.width / 2, size.height * 0.5);
            noScoresLabel.setColor(cc.color(255, 255, 255));
            this.addChild(noScoresLabel);
        } else {
            for (var i = 0; i < scores.length; i++) {
                var scoreDate = new Date(scores[i].date);
                var dateStr = scoreDate.toLocaleDateString();
                
                var scoreText = (i + 1) + ". " + scores[i].score + " points - " + dateStr;
                var scoreLabel = new cc.LabelTTF(scoreText, "Arial", 24);
                scoreLabel.setPosition(size.width / 2, yPos - (i * yStep));
                scoreLabel.setColor(cc.color(255, 255, 255));
                this.addChild(scoreLabel);
            }
        }
        
        // Create "Back to Menu" button using ccui.Button with proper background
        var backButton = new ccui.Button(res.btn_bg, res.btn_bg, res.btn_bg, ccui.Widget.LOCAL_TEXTURE);
        backButton.setTouchEnabled(true);
        backButton.setScale9Enabled(true);
        backButton.setCapInsets(cc.rect(1, 1, 1, 1));
        backButton.setContentSize(cc.size(200, 50));
        backButton.setPosition(size.width / 2, size.height * 0.15);
        // backButton.setColor(cc.color(0, 100, 200));
        backButton.setOpacity(180);
        backButton.addTouchEventListener(function(sender, type) {
            if (type === ccui.Widget.TOUCH_ENDED) {
                cc.director.runScene(new WelcomeScene());
            }
        }, this);
        
        // Add border to button
        var backBg = new cc.DrawNode();
        backBg.drawRect(
            cc.p(-100, -25),
            cc.p(100, 25),
            cc.color(0, 0, 0, 0),  // Transparent fill
            2,
            cc.color(0, 150, 250)  // Border color
        );
        backButton.addChild(backBg, -1);
        
        // Add text label on top of button
        var backLabel = new cc.LabelTTF("Back to Menu", "Arial", 30);
        backLabel.setColor(cc.color(255, 255, 255));
        backLabel.setPosition(backButton.width/2, backButton.height/2);
        backButton.addChild(backLabel, 10);
        
        this.addChild(backButton);
    }
});

// Set initial scene
window.onload = function() {
    cc.game.onStart = function() {
        // Adjust viewport
        cc.view.adjustViewPort(true);
        
        // Set fixed size without browser resizing
        cc.view.resizeWithBrowserSize(false);
        
        // Force canvas size to 1024x1024
        cc.view.setFrameSize(1024, 1024);
        
        // Set design resolution to match canvas size
        cc.view.setDesignResolutionSize(1024, 1024, cc.ResolutionPolicy.EXACT_FIT);
        debugLog('Design Resolution set to:', cc.view.getDesignResolutionSize());
        debugLog('Frame Size:', cc.view.getFrameSize());
        
        // Enable anti-aliasing
        // cc.view.enableAntiAlias(true);
        
        // Load resources
        cc.LoaderScene.preload(g_resources, function() {
            // Show welcome scene
            cc.director.runScene(new WelcomeScene());
        }, this);
    };
    
    cc.game.run();
};