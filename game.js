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

// Create a customized button with background
function createButton(labelText, fontSize, width, height, posX, posY, bgColor, borderColor) {
    // Container to hold both background and label
    var container = new cc.Node();
    container.setPosition(posX, posY);
    container.width = width;
    container.height = height;
    
    // Create background
    var background = new cc.DrawNode();
    background.drawRect(
        cc.p(-width/2, -height/2),
        cc.p(width/2, height/2),
        bgColor || cc.color(0, 100, 200, 180),
        2,
        borderColor || cc.color(0, 150, 250)
    );
    container.addChild(background);
    
    // Create label
    var label = new cc.LabelTTF(labelText, "Arial", fontSize);
    label.setColor(cc.color(255, 255, 255));
    container.addChild(label);
    
    // Store original colors for hover effects
    container.normalBgColor = bgColor || cc.color(0, 100, 200, 180);
    container.hoverBgColor = cc.color(
        Math.min(255, (bgColor?.r || 0) + 30),
        Math.min(255, (bgColor?.g || 100) + 30),
        Math.min(255, (bgColor?.b || 200) + 30),
        bgColor?.a || 180
    );
    
    return container;
}

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
        
        // Create "Start Game" button with our custom function
        var startButton = createButton(
            "Start Game", 36, 200, 50, 
            size.width / 2, size.height * 0.3,
            cc.color(0, 100, 200, 180),
            cc.color(0, 150, 250)
        );
        this.addChild(startButton);
        
        // Create "High Scores" button with our custom function
        var scoresButton = createButton(
            "High Scores", 24, 160, 40, 
            size.width / 2, size.height * 0.2,
            cc.color(0, 100, 200, 180),
            cc.color(0, 150, 250)
        );
        this.addChild(scoresButton);
        
        // Add touch event listeners
        cc.eventManager.addListener({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            swallowTouches: true,
            onTouchBegan: function(touch, event) {
                var location = touch.getLocation();
                
                // Check if start button was clicked
                var startButtonPosition = startButton.getPosition();
                var startButtonRect = cc.rect(
                    startButtonPosition.x - startButton.width/2,
                    startButtonPosition.y - startButton.height/2,
                    startButton.width,
                    startButton.height
                );
                
                if (cc.rectContainsPoint(startButtonRect, location)) {
                    cc.director.runScene(new GameScene());
                    return true;
                }
                
                // Check if high scores button was clicked
                var scoresButtonPosition = scoresButton.getPosition();
                var scoresButtonRect = cc.rect(
                    scoresButtonPosition.x - scoresButton.width/2,
                    scoresButtonPosition.y - scoresButton.height/2,
                    scoresButton.width,
                    scoresButton.height
                );
                
                if (cc.rectContainsPoint(scoresButtonRect, location)) {
                    cc.director.runScene(new HighScoreScene());
                    return true;
                }
                
                return false;
            }
        }, this);
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
        
        // Create "Play Again" button with our custom function
        var playAgainButton = createButton(
            "Play Again", 36, 200, 50, 
            size.width / 2, size.height * 0.3,
            cc.color(0, 100, 200, 180),
            cc.color(0, 150, 250)
        );
        this.addChild(playAgainButton);
        
        // Create "Main Menu" button with our custom function
        var menuButton = createButton(
            "Main Menu", 24, 160, 40, 
            size.width / 2, size.height * 0.2,
            cc.color(0, 100, 200, 180),
            cc.color(0, 150, 250)
        );
        this.addChild(menuButton);
        
        // Add touch event listeners
        cc.eventManager.addListener({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            swallowTouches: true,
            onTouchBegan: function(touch, event) {
                var location = touch.getLocation();
                
                // Check if play again button was clicked
                var playAgainPosition = playAgainButton.getPosition();
                var playAgainRect = cc.rect(
                    playAgainPosition.x - playAgainButton.width/2,
                    playAgainPosition.y - playAgainButton.height/2,
                    playAgainButton.width,
                    playAgainButton.height
                );
                
                if (cc.rectContainsPoint(playAgainRect, location)) {
                    cc.director.runScene(new GameScene());
                    return true;
                }
                
                // Check if menu button was clicked
                var menuPosition = menuButton.getPosition();
                var menuRect = cc.rect(
                    menuPosition.x - menuButton.width/2,
                    menuPosition.y - menuButton.height/2,
                    menuButton.width,
                    menuButton.height
                );
                
                if (cc.rectContainsPoint(menuRect, location)) {
                    cc.director.runScene(new WelcomeScene());
                    return true;
                }
                
                return false;
            }
        }, this);
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
        
        // Create "Back to Menu" button with our custom function
        var backButton = createButton(
            "Back to Menu", 30, 200, 50, 
            size.width / 2, size.height * 0.15,
            cc.color(0, 100, 200, 180),
            cc.color(0, 150, 250)
        );
        this.addChild(backButton);
        
        // Add touch event listeners
        cc.eventManager.addListener({
            event: cc.EventListener.TOUCH_ONE_BY_ONE,
            swallowTouches: true,
            onTouchBegan: function(touch, event) {
                var location = touch.getLocation();
                
                // Check if back button was clicked
                var backPosition = backButton.getPosition();
                var backRect = cc.rect(
                    backPosition.x - backButton.width/2,
                    backPosition.y - backButton.height/2,
                    backButton.width,
                    backButton.height
                );
                
                if (cc.rectContainsPoint(backRect, location)) {
                    cc.director.runScene(new WelcomeScene());
                    return true;
                }
                
                return false;
            }
        }, this);
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