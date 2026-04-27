import React, { useState, useEffect } from "react";
import "./EventForm.css";

export default function EventForm({
  isOpen,
  onClose,
  event,
  onSubmit,
  isLoading,
}) {
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    description: "",
    category: "",
    start_date: "",
    end_date: "",
    venue: "",
    judges: "",
    image_url: "",
    max_participants: 500,
    meals_count: 3,
    registration_deadline: "",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name || "",
        title: event.title || "",
        description: event.description || "",
        category: event.category || "",
        start_date: event.start_date
          ? new Date(event.start_date).toISOString().slice(0, 16)
          : "",
        end_date: event.end_date
          ? new Date(event.end_date).toISOString().slice(0, 16)
          : "",
        venue: Array.isArray(event.venue)
          ? event.venue.join(", ")
          : event.venue || "",
        judges: Array.isArray(event.judges)
          ? event.judges.join(", ")
          : event.judges || "",
        image_url: event.image_url || "",
        max_participants: event.max_participants || 500,
        meals_count: event.meals_count || 3,
        registration_deadline: event.registration_deadline
          ? new Date(event.registration_deadline).toISOString().slice(0, 16)
          : "",
      });
    } else {
      setFormData({
        name: "",
        title: "",
        description: "",
        category: "",
        start_date: "",
        end_date: "",
        venue: "",
        judges: "",
        image_url: "",
        max_participants: 500,
        meals_count: 3,
        registration_deadline: "",
      });
    }
    setErrors({});
  }, [event, isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Event name is required";
    }
    if (!formData.title.trim()) {
      newErrors.title = "Event title is required";
    }
    if (formData.max_participants < 1) {
      newErrors.max_participants = "Max participants must be at least 1";
    }
    if (formData.meals_count < 0) {
      newErrors.meals_count = "Meals count cannot be negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const payload = {
      name: formData.name.trim(),
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category.trim(),
      start_date: formData.start_date
        ? new Date(formData.start_date).toISOString()
        : null,
      end_date: formData.end_date
        ? new Date(formData.end_date).toISOString()
        : null,
      venue: formData.venue
        ? formData.venue
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : [],
      judges: formData.judges
        ? formData.judges
            .split(",")
            .map((j) => j.trim())
            .filter(Boolean)
        : [],
      image_url: formData.image_url.trim() || null,
      max_participants: parseInt(formData.max_participants),
      meals_count: parseInt(formData.meals_count),
      registration_deadline: formData.registration_deadline
        ? new Date(formData.registration_deadline).toISOString()
        : null,
    };

    onSubmit(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="event-form-overlay" onClick={onClose}>
      <div className="event-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="event-form-header">
          <h2>{event ? "Edit Event" : "Create New Event"}</h2>
          <button className="event-form-close" onClick={onClose}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="event-form">
          <div className="form-grid">
            {/* Left Column */}
            <div className="form-column">
              <div className="form-group">
                <label>Event Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Robo Race"
                  disabled={isLoading}
                />
                {errors.name && (
                  <span className="error-message">{errors.name}</span>
                )}
              </div>

              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Display title"
                  disabled={isLoading}
                />
                {errors.title && (
                  <span className="error-message">{errors.title}</span>
                )}
              </div>

              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="e.g., Robotics"
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Event description"
                  rows="3"
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label>Image URL</label>
                <input
                  type="url"
                  name="image_url"
                  value={formData.image_url}
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg"
                  disabled={isLoading}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Max Participants</label>
                  <input
                    type="number"
                    name="max_participants"
                    value={formData.max_participants}
                    onChange={handleChange}
                    min="1"
                    disabled={isLoading}
                  />
                  {errors.max_participants && (
                    <span className="error-message">
                      {errors.max_participants}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>Meals Count</label>
                  <input
                    type="number"
                    name="meals_count"
                    value={formData.meals_count}
                    onChange={handleChange}
                    min="0"
                    disabled={isLoading}
                  />
                  {errors.meals_count && (
                    <span className="error-message">{errors.meals_count}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="form-column">
              <div className="form-group">
                <label>Venue (comma-separated)</label>
                <textarea
                  name="venue"
                  value={formData.venue}
                  onChange={handleChange}
                  placeholder="e.g., Auditorium A, Lab B"
                  rows="2"
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label>Judges (comma-separated)</label>
                <textarea
                  name="judges"
                  value={formData.judges}
                  onChange={handleChange}
                  placeholder="e.g., John Doe, Jane Smith"
                  rows="2"
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label>Start Date & Time</label>
                <input
                  type="datetime-local"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label>End Date & Time</label>
                <input
                  type="datetime-local"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label>Registration Deadline</label>
                <input
                  type="datetime-local"
                  name="registration_deadline"
                  value={formData.registration_deadline}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary"
            >
              {isLoading
                ? "Saving..."
                : event
                  ? "Update Event"
                  : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
