class ProvidersController < ApplicationController
  FIELDS = %i[id name email].freeze

  def index
    render json: Provider.order(:id).limit(limit_param).as_json(only: FIELDS)
  end

  def show
    render json: provider.as_json(only: FIELDS)
  end

  # Query 1: each client plus their plan with this provider.
  def clients
    enrollments = provider.enrollments.includes(:client).order(:id).limit(limit_param)
    render json: enrollments.map { |e| e.client.as_json(only: FIELDS).merge("plan" => e.plan) }
  end

  # Query 4
  def journal_entries
    render json: provider.journal_entries.limit(limit_param).as_json(only: JournalEntriesController::FIELDS)
  end

  private

  def provider = @provider ||= Provider.find(params[:id])
end
