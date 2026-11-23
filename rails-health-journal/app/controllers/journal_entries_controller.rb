class JournalEntriesController < ApplicationController
  FIELDS = %i[id client_id body written_at].freeze

  # Query 3
  def index
    render json: client.journal_entries.recent_first.limit(limit_param).as_json(only: FIELDS)
  end

  def create
    entry = client.journal_entries.new(entry_params)
    if entry.save
      render json: entry.as_json(only: FIELDS), status: :created
    else
      render json: { errors: entry.errors }, status: :unprocessable_entity
    end
  end

  private

  def client = @client ||= Client.find(params[:client_id])

  def entry_params = params.permit(:body, :written_at)
end
