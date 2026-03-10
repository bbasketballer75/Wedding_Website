/**
 * GDPR Compliance Utilities
 * Data privacy, consent management, and user data rights
 */

import { supabase } from '../lib/supabase'

export enum ConsentType {
  ESSENTIAL = 'essential',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
  PERSONALIZATION = 'personalization',
}

export interface UserConsent {
  userId: string
  consentType: ConsentType
  granted: boolean
  timestamp: string
  ipAddress?: string
  userAgent?: string
}

export interface DataExportRequest {
  userId: string
  requestedAt: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  downloadUrl?: string
}

export interface DataDeletionRequest {
  userId: string
  requestedAt: string
  scheduledFor: string
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
}

/**
 * GDPR Compliance Manager
 */
export class GDPRManager {
  /**
   * Record user consent
   */
  async recordConsent(userId: string, consentType: ConsentType, granted: boolean): Promise<void> {
    try {
      const consent: UserConsent = {
        userId,
        consentType,
        granted,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      }

      await supabase.from('user_consents').insert(consent)

      // Store in localStorage for quick access
      this.storeConsentLocally(consentType, granted)
    } catch (error) {
      console.error('Record consent error:', error)
      throw error
    }
  }

  /**
   * Get user consents
   */
  async getUserConsents(userId: string): Promise<Record<ConsentType, boolean>> {
    try {
      const { data, error } = await supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })

      if (error) throw error

      // Get latest consent for each type
      const consents: Record<ConsentType, boolean> = {
        [ConsentType.ESSENTIAL]: true, // Always true
        [ConsentType.ANALYTICS]: false,
        [ConsentType.MARKETING]: false,
        [ConsentType.PERSONALIZATION]: false,
      }

      const seenTypes = new Set<ConsentType>()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data?.forEach((consent: any) => {
        if (!seenTypes.has(consent.consent_type)) {
          consents[consent.consent_type as ConsentType] = consent.granted
          seenTypes.add(consent.consent_type)
        }
      })

      return consents
    } catch (error) {
      console.error('Get user consents error:', error)
      throw error
    }
  }

  /**
   * Check if user has granted consent
   */
  async hasConsent(userId: string, consentType: ConsentType): Promise<boolean> {
    // Essential consent is always granted
    if (consentType === ConsentType.ESSENTIAL) return true

    try {
      // Check localStorage first
      const localConsent = this.getConsentLocally(consentType)
      if (localConsent !== null) return localConsent

      // Fallback to database
      const consents = await this.getUserConsents(userId)
      return consents[consentType] || false
    } catch (error) {
      console.error('Check consent error:', error)
      return false
    }
  }

  /**
   * Request data export (Right to Data Portability)
   */
  async requestDataExport(userId: string): Promise<DataExportRequest> {
    try {
      const request: DataExportRequest = {
        userId,
        requestedAt: new Date().toISOString(),
        status: 'pending',
      }

      const { data, error } = await supabase
        .from('data_export_requests')
        .insert(request)
        .select()
        .single()

      if (error) throw error

      // Trigger background job to generate export
      this.triggerDataExport(userId)

      return data
    } catch (error) {
      console.error('Request data export error:', error)
      throw error
    }
  }

  /**
   * Request data deletion (Right to be Forgotten)
   */
  async requestDataDeletion(userId: string): Promise<DataDeletionRequest> {
    try {
      // Schedule deletion 30 days from now (cooling off period)
      const scheduledFor = new Date()
      scheduledFor.setDate(scheduledFor.getDate() + 30)

      const request: DataDeletionRequest = {
        userId,
        requestedAt: new Date().toISOString(),
        scheduledFor: scheduledFor.toISOString(),
        status: 'pending',
      }

      const { data, error } = await supabase
        .from('data_deletion_requests')
        .insert(request)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Request data deletion error:', error)
      throw error
    }
  }

  /**
   * Cancel data deletion request
   */
  async cancelDataDeletion(userId: string): Promise<void> {
    try {
      await supabase
        .from('data_deletion_requests')
        .update({ status: 'cancelled' })
        .eq('user_id', userId)
        .eq('status', 'pending')
    } catch (error) {
      console.error('Cancel data deletion error:', error)
      throw error
    }
  }

  /**
   * Get privacy policy version
   */
  getPrivacyPolicyVersion(): string {
    return '1.0.0'
  }

  /**
   * Record privacy policy acceptance
   */
  async recordPrivacyPolicyAcceptance(userId: string): Promise<void> {
    try {
      await supabase.from('privacy_policy_acceptances').insert({
        user_id: userId,
        version: this.getPrivacyPolicyVersion(),
        accepted_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Record privacy policy acceptance error:', error)
      throw error
    }
  }

  /**
   * Check if user has accepted latest privacy policy
   */
  async hasAcceptedPrivacyPolicy(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('privacy_policy_acceptances')
        .select('version')
        .eq('user_id', userId)
        .order('accepted_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) return false

      return data.version === this.getPrivacyPolicyVersion()
    } catch (error) {
      console.error('Check privacy policy acceptance error:', error)
      return false
    }
  }

  /**
   * Anonymize user data
   */
  async anonymizeUserData(userId: string): Promise<void> {
    try {
      // Anonymize personal information
      await supabase
        .from('users')
        .update({
          name: 'Deleted User',
          email: `deleted_${userId}@deleted.com`,
          avatar: null,
          phone: null,
        })
        .eq('id', userId)

      // Remove sensitive data from other tables
      await this.removeSensitiveData(userId)
    } catch (error) {
      console.error('Anonymize user data error:', error)
      throw error
    }
  }

  /**
   * Store consent in localStorage
   */
  private storeConsentLocally(consentType: ConsentType, granted: boolean): void {
    const consents = this.getAllConsentsLocally()
    consents[consentType] = granted
    localStorage.setItem('user_consents', JSON.stringify(consents))
  }

  /**
   * Get consent from localStorage
   */
  private getConsentLocally(consentType: ConsentType): boolean | null {
    const consents = this.getAllConsentsLocally()
    return consents[consentType] ?? null
  }

  /**
   * Get all consents from localStorage
   */
  private getAllConsentsLocally(): Record<string, boolean> {
    try {
      const stored = localStorage.getItem('user_consents')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  /**
   * Trigger data export background job
   */
  private async triggerDataExport(userId: string): Promise<void> {
    // In production, this would trigger a backend job
    // For now, we'll create a mock export
    console.log(`Data export triggered for user ${userId}`)
  }

  /**
   * Remove sensitive data
   */
  private async removeSensitiveData(userId: string): Promise<void> {
    // Remove or anonymize data from various tables
    const tables = ['user_sessions', 'user_logins', 'user_two_factor', 'user_consents']

    for (const table of tables) {
      await supabase.from(table).delete().eq('user_id', userId)
    }
  }
}

export const gdprManager = new GDPRManager()

/**
 * Cookie Consent Banner Helper
 */
export class CookieConsentManager {
  private readonly CONSENT_KEY = 'cookie_consent_given'

  /**
   * Check if user has given cookie consent
   */
  hasGivenConsent(): boolean {
    return localStorage.getItem(this.CONSENT_KEY) === 'true'
  }

  /**
   * Record cookie consent
   */
  recordConsent(): void {
    localStorage.setItem(this.CONSENT_KEY, 'true')
  }

  /**
   * Clear cookie consent
   */
  clearConsent(): void {
    localStorage.removeItem(this.CONSENT_KEY)
  }

  /**
   * Get consent timestamp
   */
  getConsentTimestamp(): Date | null {
    const timestamp = localStorage.getItem(`${this.CONSENT_KEY}_timestamp`)
    return timestamp ? new Date(timestamp) : null
  }

  /**
   * Record consent with timestamp
   */
  recordConsentWithTimestamp(): void {
    this.recordConsent()
    localStorage.setItem(`${this.CONSENT_KEY}_timestamp`, new Date().toISOString())
  }
}

export const cookieConsentManager = new CookieConsentManager()

export default {
  gdprManager,
  cookieConsentManager,
  ConsentType,
}
