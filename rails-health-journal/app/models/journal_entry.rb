class JournalEntry < ApplicationRecord
  belongs_to :client

  attribute :written_at, default: -> { Time.current }

  validates :body, presence: true
  validates :written_at, presence: true

  # Newest first; id breaks ties so the order is deterministic.
  scope :recent_first, -> { order(written_at: :desc, id: :desc) }

  # Single query using a subquery (no join), so no duplicate rows.
  scope :for_provider, ->(provider) {
    where(client_id: Enrollment.where(provider_id: provider.id).select(:client_id)).recent_first
  }
end
