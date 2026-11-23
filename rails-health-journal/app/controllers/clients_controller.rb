class ClientsController < ApplicationController
  FIELDS = %i[id name email].freeze

  def index
    render json: Client.order(:id).limit(limit_param).as_json(only: FIELDS)
  end

  def show
    render json: client.as_json(only: FIELDS)
  end

  # Query 2: each provider plus this client's plan with them.
  def providers
    enrollments = client.enrollments.includes(:provider).order(:id).limit(limit_param)
    render json: enrollments.map { |e| e.provider.as_json(only: FIELDS).merge("plan" => e.plan) }
  end

  private

  def client = @client ||= Client.find(params[:id])
end
