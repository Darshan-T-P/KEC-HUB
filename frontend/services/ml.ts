
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';

export type MLAction = 'applied' | 'liked' | 'clicked' | 'viewed';

export const mlService = {
    /**
     * Send user interaction feedback to the ML model.
     * @param email The user's email
     * @param opportunityId The ID of the opportunity
     * @param action The type of interaction
     */
    sendFeedback: async (email: string, opportunityId: string, action: MLAction): Promise<void> => {
        try {
            await fetch(`${API_BASE_URL}/ml/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, opportunity_id: opportunityId, action })
            });
        } catch (e) {
            console.error('Failed to send ML feedback:', e);
        }
    }
};
