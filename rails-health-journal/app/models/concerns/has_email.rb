# Shared by Provider and Client: required name, normalized unique email.
module HasEmail
  extend ActiveSupport::Concern

  included do
    normalizes :email, with: ->(e) { e.strip.downcase }
    validates :name, presence: true
    validates :email, presence: true,
                      format: { with: URI::MailTo::EMAIL_REGEXP, allow_blank: true },
                      uniqueness: true
  end
end
