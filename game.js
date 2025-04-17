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
    whale_png: "resource/whale.png"
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
        
        // Start button
        var startBtn = new cc.LabelTTF("Start Game", "Arial", 36);
        startBtn.setPosition(size.width / 2, size.height * 0.3);
        startBtn.setColor(cc.color(255, 255, 255));
        
        // Add background to button for better visibility
        var btnBg = new cc.DrawNode();
        btnBg.drawRect(
            cc.p(startBtn.x - 100, startBtn.y - 25),
            cc.p(startBtn.x + 100, startBtn.y + 25),
            cc.color(0, 100, 200, 180),
            2,
            cc.color(0, 150, 250)
        );
        this.addChild(btnBg);
        this.addChild(startBtn);
        
        // Make button clickable
        cc.eventManager.addListener({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            swallowTouches: true,
            onTouchBegan: function(touch, event) {
                var target = event.getCurrentTarget();
                var locationInNode = target.convertToNodeSpace(touch.getLocation());
                var s = target.getContentSize();
                var rect = cc.rect(-s.width/2, -s.height/2, s.width, s.height);
                
                if (cc.rectContainsPoint(rect, locationInNode)) {
                    // Start game
                    cc.director.runScene(new GameScene());
                    return true;
                }
                return false;
            }
        }, startBtn);
        
        // High scores button
        var scoresBtn = new cc.LabelTTF("High Scores", "Arial", 24);
        scoresBtn.setPosition(size.width / 2, size.height * 0.2);
        scoresBtn.setColor(cc.color(255, 255, 255));
        
        // Add background to button
        var scoresBtnBg = new cc.DrawNode();
        scoresBtnBg.drawRect(
            cc.p(scoresBtn.x - 80, scoresBtn.y - 20),
            cc.p(scoresBtn.x + 80, scoresBtn.y + 20),
            cc.color(0, 100, 200, 180),
            2,
            cc.color(0, 150, 250)
        );
        this.addChild(scoresBtnBg);
        this.addChild(scoresBtn);
        
        // Make high scores button clickable
        cc.eventManager.addListener({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            swallowTouches: true,
            onTouchBegan: function(touch, event) {
                var target = event.getCurrentTarget();
                var locationInNode = target.convertToNodeSpace(touch.getLocation());
                var s = target.getContentSize();
                var rect = cc.rect(-s.width/2, -s.height/2, s.width, s.height);
                
                if (cc.rectContainsPoint(rect, locationInNode)) {
                    // Show high scores
                    cc.director.runScene(new HighScoreScene());
                    return true;
                }
                return false;
            }
        }, scoresBtn);
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
            
            // Random position
            var x = Math.random() * (size.width - 100) + 50;
            var y = Math.random() * (size.height - 150) + 50;
            self.whale.setPosition(x, y);
            
            // Show whale
            self.whale.setVisible(true);
            
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
        
        // Play Again button
        var playAgainBtn = new cc.LabelTTF("Play Again", "Arial", 36);
        playAgainBtn.setPosition(size.width / 2, size.height * 0.3);
        playAgainBtn.setColor(cc.color(255, 255, 255));
        
        // Add background to button
        var btnBg = new cc.DrawNode();
        btnBg.drawRect(
            cc.p(playAgainBtn.x - 100, playAgainBtn.y - 25),
            cc.p(playAgainBtn.x + 100, playAgainBtn.y + 25),
            cc.color(0, 100, 200, 180),
            2,
            cc.color(0, 150, 250)
        );
        this.addChild(btnBg);
        this.addChild(playAgainBtn);
        
        // Make button clickable
        cc.eventManager.addListener({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            swallowTouches: true,
            onTouchBegan: function(touch, event) {
                var target = event.getCurrentTarget();
                var locationInNode = target.convertToNodeSpace(touch.getLocation());
                var s = target.getContentSize();
                var rect = cc.rect(-s.width/2, -s.height/2, s.width, s.height);
                
                if (cc.rectContainsPoint(rect, locationInNode)) {
                    // Start new game
                    cc.director.runScene(new GameScene());
                    return true;
                }
                return false;
            }
        }, playAgainBtn);
        
        // Main Menu button
        var menuBtn = new cc.LabelTTF("Main Menu", "Arial", 24);
        menuBtn.setPosition(size.width / 2, size.height * 0.2);
        menuBtn.setColor(cc.color(255, 255, 255));
        
        // Add background to button
        var menuBtnBg = new cc.DrawNode();
        menuBtnBg.drawRect(
            cc.p(menuBtn.x - 80, menuBtn.y - 20),
            cc.p(menuBtn.x + 80, menuBtn.y + 20),
            cc.color(0, 100, 200, 180),
            2,
            cc.color(0, 150, 250)
        );
        this.addChild(menuBtnBg);
        this.addChild(menuBtn);
        
        // Make menu button clickable
        cc.eventManager.addListener({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            swallowTouches: true,
            onTouchBegan: function(touch, event) {
                var target = event.getCurrentTarget();
                var locationInNode = target.convertToNodeSpace(touch.getLocation());
                var s = target.getContentSize();
                var rect = cc.rect(-s.width/2, -s.height/2, s.width, s.height);
                
                if (cc.rectContainsPoint(rect, locationInNode)) {
                    // Go to main menu
                    cc.director.runScene(new WelcomeScene());
                    return true;
                }
                return false;
            }
        }, menuBtn);
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
        
        // Back button
        var backBtn = new cc.LabelTTF("Back to Menu", "Arial", 30);
        backBtn.setPosition(size.width / 2, size.height * 0.15);
        backBtn.setColor(cc.color(255, 255, 255));
        
        // Add background to button
        var btnBg = new cc.DrawNode();
        btnBg.drawRect(
            cc.p(backBtn.x - 100, backBtn.y - 25),
            cc.p(backBtn.x + 100, backBtn.y + 25),
            cc.color(0, 100, 200, 180),
            2,
            cc.color(0, 150, 250)
        );
        this.addChild(btnBg);
        this.addChild(backBtn);
        
        // Make button clickable
        cc.eventManager.addListener({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            swallowTouches: true,
            onTouchBegan: function(touch, event) {
                var target = event.getCurrentTarget();
                var locationInNode = target.convertToNodeSpace(touch.getLocation());
                var s = target.getContentSize();
                var rect = cc.rect(-s.width/2, -s.height/2, s.width, s.height);
                
                if (cc.rectContainsPoint(rect, locationInNode)) {
                    // Go back to welcome scene
                    cc.director.runScene(new WelcomeScene());
                    return true;
                }
                return false;
            }
        }, backBtn);
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
