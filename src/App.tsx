import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Progress } from './components/ui/progress'
import { Badge } from './components/ui/badge'

interface Bubble {
  id: string
  x: number
  y: number
  size: number
  color: string
  speed: number
  points: number
  type: 'normal' | 'bonus' | 'bomb'
}

interface Particle {
  id: string
  x: number
  y: number
  color: string
  velocity: { x: number; y: number }
}

interface Achievement {
  id: string
  title: string
  description: string
  unlocked: boolean
  icon: string
}

const BUBBLE_COLORS = [
  { primary: '#FF6B6B', secondary: '#FF8E8E' }, // Red
  { primary: '#4ECDC4', secondary: '#6EDDD6' }, // Teal
  { primary: '#45B7D1', secondary: '#67C5E1' }, // Blue
  { primary: '#96CEB4', secondary: '#B8E6C1' }, // Green
  { primary: '#FFEAA7', secondary: '#FDCB6E' }, // Yellow
  { primary: '#DDA0DD', secondary: '#E6B8E6' }, // Purple
  { primary: '#FFB347', secondary: '#FFC470' }, // Orange
]

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_pop', title: 'First Pop!', description: 'Pop your first bubble', unlocked: false, icon: '🎈' },
  { id: 'combo_5', title: 'Combo Master', description: 'Achieve a 5x combo', unlocked: false, icon: '🔥' },
  { id: 'score_1000', title: 'High Scorer', description: 'Reach 1000 points', unlocked: false, icon: '⭐' },
  { id: 'speed_demon', title: 'Speed Demon', description: 'Pop 10 bubbles in 5 seconds', unlocked: false, icon: '⚡' },
  { id: 'bubble_master', title: 'Bubble Master', description: 'Pop 100 bubbles total', unlocked: false, icon: '👑' },
]

function App() {
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [particles, setParticles] = useState<Particle[]>([])
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [level, setLevel] = useState(1)
  const [gameActive, setGameActive] = useState(false)
  const [achievements, setAchievements] = useState<Achievement[]>(ACHIEVEMENTS)
  const [showAchievement, setShowAchievement] = useState<Achievement | null>(null)
  const [totalBubbles, setTotalBubbles] = useState(0)
  const [recentPops, setRecentPops] = useState<number[]>([])
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('bubblePopHighScore') || '0')
  })

  const gameAreaRef = useRef<HTMLDivElement>(null)
  const comboTimeoutRef = useRef<NodeJS.Timeout>()
  const spawnIntervalRef = useRef<NodeJS.Timeout>()

  const generateBubble = useCallback((): Bubble => {
    const gameArea = gameAreaRef.current
    if (!gameArea) return {} as Bubble

    const rect = gameArea.getBoundingClientRect()
    const size = Math.random() * 40 + 40 // 40-80px
    const colorIndex = Math.floor(Math.random() * BUBBLE_COLORS.length)
    const color = BUBBLE_COLORS[colorIndex]
    
    // Determine bubble type
    let type: 'normal' | 'bonus' | 'bomb' = 'normal'
    const rand = Math.random()
    if (rand < 0.1) type = 'bonus' // 10% chance
    else if (rand < 0.15) type = 'bomb' // 5% chance

    return {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * (rect.width - size),
      y: Math.random() * (rect.height - size),
      size,
      color: type === 'bonus' ? '#FFD700' : type === 'bomb' ? '#FF4444' : color.primary,
      speed: Math.random() * 2 + 1,
      points: type === 'bonus' ? 50 : type === 'bomb' ? -20 : Math.floor(size / 8) + 5,
      type
    }
  }, [])

  const createParticles = useCallback((x: number, y: number, color: string, count: number = 8) => {
    const newParticles: Particle[] = []
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: Math.random().toString(36).substr(2, 9),
        x,
        y,
        color,
        velocity: {
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 200
        }
      })
    }
    setParticles(prev => [...prev, ...newParticles])
    
    // Remove particles after animation
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)))
    }, 600)
  }, [])

  const checkAchievements = useCallback((newScore: number, newCombo: number, newTotal: number) => {
    setAchievements(prev => {
      const updated = [...prev]
      let hasNewAchievement = false

      // Check achievements
      if (newTotal >= 1 && !updated.find(a => a.id === 'first_pop')?.unlocked) {
        updated.find(a => a.id === 'first_pop')!.unlocked = true
        setShowAchievement(updated.find(a => a.id === 'first_pop')!)
        hasNewAchievement = true
      }
      
      if (newCombo >= 5 && !updated.find(a => a.id === 'combo_5')?.unlocked) {
        updated.find(a => a.id === 'combo_5')!.unlocked = true
        setShowAchievement(updated.find(a => a.id === 'combo_5')!)
        hasNewAchievement = true
      }
      
      if (newScore >= 1000 && !updated.find(a => a.id === 'score_1000')?.unlocked) {
        updated.find(a => a.id === 'score_1000')!.unlocked = true
        setShowAchievement(updated.find(a => a.id === 'score_1000')!)
        hasNewAchievement = true
      }
      
      if (newTotal >= 100 && !updated.find(a => a.id === 'bubble_master')?.unlocked) {
        updated.find(a => a.id === 'bubble_master')!.unlocked = true
        setShowAchievement(updated.find(a => a.id === 'bubble_master')!)
        hasNewAchievement = true
      }

      // Check speed demon (10 pops in 5 seconds)
      const now = Date.now()
      const recentPopsInWindow = recentPops.filter(time => now - time < 5000)
      if (recentPopsInWindow.length >= 10 && !updated.find(a => a.id === 'speed_demon')?.unlocked) {
        updated.find(a => a.id === 'speed_demon')!.unlocked = true
        setShowAchievement(updated.find(a => a.id === 'speed_demon')!)
        hasNewAchievement = true
      }

      return updated
    })
  }, [recentPops])

  const popBubble = useCallback((bubble: Bubble) => {
    if (!gameActive) return

    // Add to recent pops for speed achievement
    setRecentPops(prev => [...prev.slice(-9), Date.now()])

    // Create particles
    createParticles(bubble.x + bubble.size / 2, bubble.y + bubble.size / 2, bubble.color, bubble.type === 'bonus' ? 12 : 8)

    // Update score and combo
    const newCombo = combo + 1
    const comboMultiplier = Math.floor(newCombo / 5) + 1
    const points = bubble.points * comboMultiplier
    const newScore = Math.max(0, score + points)
    const newTotal = totalBubbles + 1

    setScore(newScore)
    setCombo(newCombo)
    setTotalBubbles(newTotal)

    // Update high score
    if (newScore > highScore) {
      setHighScore(newScore)
      localStorage.setItem('bubblePopHighScore', newScore.toString())
    }

    // Check for level up
    if (newScore > level * 500) {
      setLevel(prev => prev + 1)
    }

    // Remove bubble
    setBubbles(prev => prev.filter(b => b.id !== bubble.id))

    // Reset combo timeout
    if (comboTimeoutRef.current) {
      clearTimeout(comboTimeoutRef.current)
    }
    comboTimeoutRef.current = setTimeout(() => {
      setCombo(0)
    }, 2000)

    // Check achievements
    checkAchievements(newScore, newCombo, newTotal)

    // Show score popup
    const scorePopup = document.createElement('div')
    scorePopup.className = 'score-popup fixed pointer-events-none text-2xl font-bold z-50'
    scorePopup.style.left = `${bubble.x + bubble.size / 2}px`
    scorePopup.style.top = `${bubble.y + bubble.size / 2}px`
    scorePopup.style.color = bubble.type === 'bonus' ? '#FFD700' : bubble.type === 'bomb' ? '#FF4444' : '#4ECDC4'
    scorePopup.textContent = `${points > 0 ? '+' : ''}${points}`
    document.body.appendChild(scorePopup)

    setTimeout(() => {
      document.body.removeChild(scorePopup)
    }, 1000)
  }, [gameActive, combo, score, totalBubbles, highScore, level, createParticles, checkAchievements])

  const startGame = useCallback(() => {
    setGameActive(true)
    setScore(0)
    setCombo(0)
    setLevel(1)
    setBubbles([])
    setParticles([])
    setRecentPops([])

    // Start spawning bubbles
    const spawnBubble = () => {
      setBubbles(prev => {
        if (prev.length < 8 + level) {
          return [...prev, generateBubble()]
        }
        return prev
      })
    }

    spawnBubble() // Initial bubble
    spawnIntervalRef.current = setInterval(spawnBubble, Math.max(1000 - level * 50, 300))
  }, [generateBubble, level])

  const pauseGame = useCallback(() => {
    setGameActive(false)
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current)
    }
  }, [])

  // Move bubbles
  useEffect(() => {
    if (!gameActive) return

    const moveInterval = setInterval(() => {
      setBubbles(prev => prev.map(bubble => ({
        ...bubble,
        y: bubble.y + bubble.speed,
      })).filter(bubble => bubble.y < window.innerHeight)) // Remove bubbles that fall off screen
    }, 50)

    return () => clearInterval(moveInterval)
  }, [gameActive])

  // Hide achievement notification
  useEffect(() => {
    if (showAchievement) {
      const timer = setTimeout(() => {
        setShowAchievement(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [showAchievement])

  // Cleanup intervals
  useEffect(() => {
    return () => {
      if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current)
      if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/10 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      {/* Game UI */}
      <div className="relative z-10 p-4">
        {/* Top HUD */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-4">
            <Card className="px-4 py-2 bg-black/20 border-white/10">
              <div className="text-sm text-white/70">Score</div>
              <div className="text-2xl font-bold text-white">{score.toLocaleString()}</div>
            </Card>
            <Card className="px-4 py-2 bg-black/20 border-white/10">
              <div className="text-sm text-white/70">High Score</div>
              <div className="text-xl font-bold text-accent">{highScore.toLocaleString()}</div>
            </Card>
          </div>

          <div className="flex gap-4 items-center">
            {combo > 0 && (
              <Badge className={`text-lg px-3 py-1 ${combo >= 5 ? 'combo-glow bg-accent' : 'bg-primary'}`}>
                {combo}x Combo!
              </Badge>
            )}
            <Card className="px-4 py-2 bg-black/20 border-white/10">
              <div className="text-sm text-white/70">Level</div>
              <div className="text-xl font-bold text-white">{level}</div>
            </Card>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-white/70 mb-1">
            <span>Progress to Level {level + 1}</span>
            <span>{score % 500}/500</span>
          </div>
          <Progress value={(score % 500) / 5} className="h-2" />
        </div>

        {/* Game Controls */}
        <div className="flex justify-center gap-4 mb-6">
          {!gameActive ? (
            <Button onClick={startGame} size="lg" className="bg-primary hover:bg-primary/90 text-white px-8 py-3 text-lg">
              {score > 0 ? 'Resume Game' : 'Start Game'}
            </Button>
          ) : (
            <Button onClick={pauseGame} variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10 px-8 py-3 text-lg">
              Pause Game
            </Button>
          )}
        </div>
      </div>

      {/* Game Area */}
      <div ref={gameAreaRef} className="absolute inset-0 overflow-hidden">
        {/* Bubbles */}
        {bubbles.map(bubble => (
          <div
            key={bubble.id}
            className="bubble absolute"
            style={{
              left: bubble.x,
              top: bubble.y,
              width: bubble.size,
              height: bubble.size,
              '--bubble-color-1': bubble.color,
              '--bubble-color-2': bubble.type === 'bonus' ? '#FFA500' : bubble.type === 'bomb' ? '#CC0000' : bubble.color,
              animationDelay: `${Math.random() * 2}s`
            } as React.CSSProperties}
            onClick={() => popBubble(bubble)}
          >
            {bubble.type === 'bonus' && (
              <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                ⭐
              </div>
            )}
            {bubble.type === 'bomb' && (
              <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">
                💣
              </div>
            )}
          </div>
        ))}

        {/* Particles */}
        {particles.map(particle => (
          <div
            key={particle.id}
            className="particle w-2 h-2 rounded-full"
            style={{
              left: particle.x,
              top: particle.y,
              backgroundColor: particle.color,
              '--particle-x': `${particle.velocity.x}px`,
              '--particle-y': `${particle.velocity.y}px`
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Achievement Notification */}
      {showAchievement && (
        <div className="fixed top-20 right-4 z-50 animate-slide-up">
          <Card className="p-4 bg-accent/90 border-accent text-accent-foreground">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{showAchievement.icon}</span>
              <div>
                <div className="font-bold">{showAchievement.title}</div>
                <div className="text-sm opacity-90">{showAchievement.description}</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Achievements Panel */}
      <div className="fixed bottom-4 left-4 z-40">
        <Card className="p-3 bg-black/20 border-white/10">
          <div className="text-sm text-white/70 mb-2">Achievements</div>
          <div className="flex gap-2">
            {achievements.map(achievement => (
              <div
                key={achievement.id}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  achievement.unlocked ? 'bg-accent text-accent-foreground' : 'bg-white/10 text-white/30'
                }`}
                title={`${achievement.title}: ${achievement.description}`}
              >
                {achievement.icon}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Stats */}
      <div className="fixed bottom-4 right-4 z-40">
        <Card className="p-3 bg-black/20 border-white/10">
          <div className="text-sm text-white/70">Total Bubbles Popped</div>
          <div className="text-xl font-bold text-white">{totalBubbles}</div>
        </Card>
      </div>
    </div>
  )
}

export default App