class Provider < ApplicationRecord
  include HasEmail

  has_many :enrollments, dependent: :destroy
  has_many :clients, through: :enrollments

  # Query 4: all journal entries across this provider's clients, newest first.
  def journal_entries
    JournalEntry.for_provider(self)
  end
end
