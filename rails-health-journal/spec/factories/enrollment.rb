FactoryBot.define do
  factory :enrollment do
    association :provider
    association :client
    plan { "basic" }

    trait :premium do
      plan { "premium" }
    end
  end
end
