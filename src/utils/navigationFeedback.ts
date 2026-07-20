export type FeedbackKind = 'success' | 'error'

export type NavigationFeedback = {
  kind: FeedbackKind
  message: string
}

export type NavigationFeedbackState = {
  feedback?: NavigationFeedback
}
