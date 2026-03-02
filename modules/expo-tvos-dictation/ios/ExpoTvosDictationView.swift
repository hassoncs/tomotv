import ExpoModulesCore
import UIKit

class ExpoTvosDictationView: ExpoView, UITextFieldDelegate {
  let onTextChange = EventDispatcher()
  let onSubmit = EventDispatcher()
  let onFocus = EventDispatcher()
  let onBlur = EventDispatcher()

  let textField = UITextField()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    setupView()
  }

  private func setupView() {
    // Basic setup
    textField.delegate = self
    textField.keyboardType = .default
    textField.autocorrectionType = .yes
    textField.spellCheckingType = .yes // Essential for dictation hint
    
    // UI styling
    textField.backgroundColor = .clear
    textField.translatesAutoresizingMaskIntoConstraints = false
    
    addSubview(textField)
    NSLayoutConstraint.activate([
      textField.leadingAnchor.constraint(equalTo: leadingAnchor),
      textField.trailingAnchor.constraint(equalTo: trailingAnchor),
      textField.topAnchor.constraint(equalTo: topAnchor),
      textField.bottomAnchor.constraint(equalTo: bottomAnchor)
    ])
    
    // Add text change listener
    textField.addTarget(self, action: #selector(textDidChange), for: .editingChanged)
  }

  // MARK: - Props

  func setText(_ text: String) {
    if textField.text != text {
      textField.text = text
    }
  }

  func setPlaceholder(_ text: String) {
    textField.placeholder = text
  }

  func setPlaceholderColor(_ hex: String) {
    let color = colorWithHexString(hex: hex)
    if let placeholder = textField.placeholder {
      textField.attributedPlaceholder = NSAttributedString(
        string: placeholder,
        attributes: [NSAttributedString.Key.foregroundColor: color]
      )
    }
  }

  func setTextColor(_ hex: String) {
    textField.textColor = colorWithHexString(hex: hex)
  }

  // MARK: - UITextFieldDelegate

  @objc func textDidChange() {
    onTextChange([
      "text": textField.text ?? ""
    ])
  }

  func textFieldShouldReturn(_ textField: UITextField) -> Bool {
    onSubmit([
      "text": textField.text ?? ""
    ])
    textField.resignFirstResponder()
    return true
  }

  func textFieldDidBeginEditing(_ textField: UITextField) {
    onFocus()
  }

  func textFieldDidEndEditing(_ textField: UITextField) {
    onBlur()
  }

  // MARK: - Helpers

  func colorWithHexString(hex: String) -> UIColor {
    var cString:String = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()

    if (cString.hasPrefix("#")) {
      cString.remove(at: cString.startIndex)
    }

    if ((cString.count) != 6) {
      return UIColor.gray
    }

    var rgbValue:UInt64 = 0
    Scanner(string: cString).scanHexInt64(&rgbValue)

    return UIColor(
      red: CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0,
      green: CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0,
      blue: CGFloat(rgbValue & 0x0000FF) / 255.0,
      alpha: CGFloat(1.0)
    )
  }
}
