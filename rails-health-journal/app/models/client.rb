class Client < ApplicationRecord
  include HasEmail

  has_many :enrollments, dependent: :destroy
  has_many :providers, through: :enrollments
  has_many :journal_entries, dependent: :delete_all
end
