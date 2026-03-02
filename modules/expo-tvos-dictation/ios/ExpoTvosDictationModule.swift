import ExpoModulesCore

public class ExpoTvosDictationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoTvosDictation")

    View(ExpoTvosDictationView.self) {
      Events("onTextChange", "onSubmit", "onFocus", "onBlur")

      Prop("text") { (view: ExpoTvosDictationView, text: String) in
        view.setText(text)
      }
      
      Prop("placeholder") { (view: ExpoTvosDictationView, placeholder: String) in
        view.setPlaceholder(placeholder)
      }
      
      Prop("placeholderTextColor") { (view: ExpoTvosDictationView, colorHex: String) in
        view.setPlaceholderColor(colorHex)
      }

      Prop("textColor") { (view: ExpoTvosDictationView, colorHex: String) in
        view.setTextColor(colorHex)
      }
    }
  }
}
