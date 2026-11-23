class ApplicationController < ActionController::API
  MAX_LIMIT = 100
  DEFAULT_LIMIT = 50

  rescue_from ActiveRecord::RecordNotFound do |e|
    render json: { error: "#{e.model || 'Record'} not found" }, status: :not_found
  end

  private

  def limit_param
    limit = Integer(params[:limit].to_s, exception: false)
    limit&.positive? ? [limit, MAX_LIMIT].min : DEFAULT_LIMIT
  end
end
