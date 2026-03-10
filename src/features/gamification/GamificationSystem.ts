/**
 * Gamification System
 * Engagement features including achievements, badges, and points
 */

import { supabase } from '../../lib/supabase'

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  points: number
  unlocked: boolean
  unlockedAt?: string
  progress?: number
  total?: number
}

export interface UserScore {
  userId: string
  points: number
  level: number
  achievements: string[]
  rank?: number
}

export const ACHIEVEMENTS: Omit<Achievement, 'unlocked'>[] = [
  {
    id: 'first_visit',
    title: 'Welcome!',
    description: 'Visited the wedding website',
    icon: '👋',
    points: 10,
  },
  {
    id: 'first_like',
    title: 'First Love',
    description: 'Liked your first photo',
    icon: '❤️',
    points: 20,
  },
  {
    id: 'photo_enthusiast',
    title: 'Photo Enthusiast',
    description: 'Liked 10 photos',
    icon: '📸',
    points: 50,
    progress: 0,
    total: 10,
  },
  {
    id: 'super_fan',
    title: 'Super Fan',
    description: 'Liked 50 photos',
    icon: '⭐',
    points: 100,
    progress: 0,
    total: 50,
  },
  {
    id: 'guestbook_writer',
    title: 'Memory Maker',
    description: 'Left a message in the guestbook',
    icon: '✍️',
    points: 30,
  },
  {
    id: 'storyteller',
    title: 'Storyteller',
    description: 'Shared your own wedding story',
    icon: '📖',
    points: 50,
  },
  {
    id: 'photo_uploader',
    title: 'Photographer',
    description: 'Uploaded your first photo',
    icon: '📷',
    points: 40,
  },
  {
    id: 'prolific_photographer',
    title: 'Prolific Photographer',
    description: 'Uploaded 10 photos',
    icon: '🎥',
    points: 100,
    progress: 0,
    total: 10,
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'One of the first 50 visitors',
    icon: '🐦',
    points: 25,
  },
  {
    id: 'all_pages',
    title: 'Explorer',
    description: 'Visited all pages of the website',
    icon: '🗺️',
    points: 30,
    progress: 0,
    total: 6,
  },
  {
    id: 'perfect_week',
    title: 'Devoted Fan',
    description: 'Visited the site 7 days in a row',
    icon: '🔥',
    points: 75,
    progress: 0,
    total: 7,
  },
  {
    id: 'share_master',
    title: 'Share Master',
    description: 'Shared the website on social media',
    icon: '📢',
    points: 20,
  },
]

export class GamificationSystem {
  private userId: string | null = null

  /**
   * Initialize gamification for user
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId

    // Track first visit
    await this.trackAchievement('first_visit')
  }

  /**
   * Track achievement progress
   */
  async trackAchievement(achievementId: string, progress?: number): Promise<boolean> {
    if (!this.userId) return false

    try {
      const achievement = ACHIEVEMENTS.find(a => a.id === achievementId)
      if (!achievement) return false

      // Check if already unlocked
      const { data: existing } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', this.userId)
        .eq('achievement_id', achievementId)
        .single()

      if (existing) return false

      // Progressive achievements
      if (achievement.total && progress !== undefined) {
        const { data: progressData } = await supabase
          .from('achievement_progress')
          .select('progress')
          .eq('user_id', this.userId)
          .eq('achievement_id', achievementId)
          .single()

        const currentProgress = (progressData?.progress || 0) + progress

        await supabase.from('achievement_progress').upsert({
          user_id: this.userId,
          achievement_id: achievementId,
          progress: currentProgress,
        })

        if (currentProgress >= achievement.total) {
          return await this.unlockAchievement(achievementId)
        }

        return false
      }

      // Instant unlock achievements
      return await this.unlockAchievement(achievementId)
    } catch (error) {
      console.error('Track achievement error:', error)
      return false
    }
  }

  /**
   * Unlock an achievement
   */
  private async unlockAchievement(achievementId: string): Promise<boolean> {
    if (!this.userId) return false

    try {
      const achievement = ACHIEVEMENTS.find(a => a.id === achievementId)
      if (!achievement) return false

      // Record achievement
      await supabase.from('user_achievements').insert({
        user_id: this.userId,
        achievement_id: achievementId,
        unlocked_at: new Date().toISOString(),
      })

      // Award points
      await this.awardPoints(achievement.points)

      // Show notification
      this.showAchievementNotification(achievement as Achievement)

      return true
    } catch (error) {
      console.error('Unlock achievement error:', error)
      return false
    }
  }

  /**
   * Award points to user
   */
  async awardPoints(points: number): Promise<void> {
    if (!this.userId) return

    try {
      // Get current score
      const { data: score } = await supabase
        .from('user_scores')
        .select('points, level')
        .eq('user_id', this.userId)
        .single()

      const currentPoints = score?.points || 0
      const newPoints = currentPoints + points

      // Calculate level (100 points per level)
      const newLevel = Math.floor(newPoints / 100) + 1

      // Update score
      await supabase.from('user_scores').upsert({
        user_id: this.userId,
        points: newPoints,
        level: newLevel,
        updated_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Award points error:', error)
    }
  }

  /**
   * Get user achievements
   */
  async getUserAchievements(): Promise<Achievement[]> {
    if (!this.userId) return []

    try {
      const { data: unlocked } = await supabase
        .from('user_achievements')
        .select('achievement_id, unlocked_at')
        .eq('user_id', this.userId)

      const { data: progress } = await supabase
        .from('achievement_progress')
        .select('achievement_id, progress')
        .eq('user_id', this.userId)

      const unlockedIds = new Set(unlocked?.map(a => a.achievement_id) || [])
      const progressMap = new Map(progress?.map(p => [p.achievement_id, p.progress]) || [])

      return ACHIEVEMENTS.map(achievement => ({
        ...achievement,
        unlocked: unlockedIds.has(achievement.id),
        unlockedAt: unlocked?.find(a => a.achievement_id === achievement.id)?.unlocked_at,
        progress: progressMap.get(achievement.id) || 0,
      }))
    } catch (error) {
      console.error('Get user achievements error:', error)
      return []
    }
  }

  /**
   * Get user score
   */
  async getUserScore(): Promise<UserScore | null> {
    if (!this.userId) return null

    try {
      const { data } = await supabase
        .from('user_scores')
        .select('*')
        .eq('user_id', this.userId)
        .single()

      if (!data) {
        return {
          userId: this.userId,
          points: 0,
          level: 1,
          achievements: [],
        }
      }

      // Get achievements
      const { data: achievements } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', this.userId)

      return {
        userId: this.userId,
        points: data.points,
        level: data.level,
        achievements: achievements?.map(a => a.achievement_id) || [],
      }
    } catch (error) {
      console.error('Get user score error:', error)
      return null
    }
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit: number = 10): Promise<UserScore[]> {
    try {
      const { data } = await supabase
        .from('user_scores')
        .select('user_id, points, level')
        .order('points', { ascending: false })
        .limit(limit)

      if (!data) return []

      return data.map((score, index) => ({
        userId: score.user_id,
        points: score.points,
        level: score.level,
        achievements: [],
        rank: index + 1,
      }))
    } catch (error) {
      console.error('Get leaderboard error:', error)
      return []
    }
  }

  /**
   * Show achievement notification
   */
  private showAchievementNotification(achievement: Achievement): void {
    // Dispatch custom event
    const event = new CustomEvent('achievement-unlocked', {
      detail: achievement,
    })
    window.dispatchEvent(event)

    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Achievement Unlocked!', {
        body: `${achievement.icon} ${achievement.title} (+${achievement.points} points)`,
        icon: '/icons/icon-192x192.png',
      })
    }
  }

  /**
   * Track photo like
   */
  async trackPhotoLike(): Promise<void> {
    await this.trackAchievement('first_like')
    await this.trackAchievement('photo_enthusiast', 1)
    await this.trackAchievement('super_fan', 1)
  }

  /**
   * Track guestbook entry
   */
  async trackGuestbookEntry(): Promise<void> {
    await this.trackAchievement('guestbook_writer')
  }

  /**
   * Track photo upload
   */
  async trackPhotoUpload(): Promise<void> {
    await this.trackAchievement('photo_uploader')
    await this.trackAchievement('prolific_photographer', 1)
  }

  /**
   * Track page visit
   */
  async trackPageVisit(page: string): Promise<void> {
    if (!this.userId) return

    try {
      // Store visited pages
      const visitedPages = new Set(JSON.parse(localStorage.getItem('visited_pages') || '[]'))
      visitedPages.add(page)
      localStorage.setItem('visited_pages', JSON.stringify([...visitedPages]))

      // Check explorer achievement
      if (visitedPages.size >= 6) {
        await this.trackAchievement('all_pages')
      }
    } catch (error) {
      console.error('Track page visit error:', error)
    }
  }

  /**
   * Track social share
   */
  async trackShare(): Promise<void> {
    await this.trackAchievement('share_master')
  }
}

export const gamificationSystem = new GamificationSystem()
export default gamificationSystem
