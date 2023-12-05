from flask import Flask, request, jsonify
import os

app = Flask(__name__)


@app.route('/upload', methods=['POST'])
def upload_file():
    if 'picture' in request.files:
        picture = request.files['picture']
        if picture.filename != '':
            save_path = os.path.join('uploads', picture.filename)
            picture.save(save_path)
            return jsonify({'message': 'File uploaded successfully.'})
    return jsonify({'message': 'No file selected.'})


if __name__ == '__main__':
    if not os.path.exists('uploads'):
        os.mkdir('uploads')
    app.run(debug=True)
