FactoryBot.define do
  factory :journal_entry do
    association :client
    sequence(:body) { |n| "Journal entry #{n}" }
    # written_at is left to the model default unless a spec sets it.
  end
end
